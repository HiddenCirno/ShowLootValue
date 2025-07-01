using BepInEx;
using BepInEx.Configuration;
using HarmonyLib;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using EFT;
using EFT.InventoryLogic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using EFT.UI.SessionEnd;
using EFT.UI;
using SPT.Common.Http;

namespace PriceDisplay
{
    [BepInPlugin("com.pricedisplay.plugin", "PriceDisplay", "1.0.0")]
    public class PriceDisplayPlugin : BaseUnityPlugin
    {
        // UI 组件引用
        public static GameObject OriginalRublesUI { get; set; }
        public static GameObject ClonedRublesUI { get; set; }

        // 游戏数据
        public static Player CurrentPlayer { get; set; } = new Player();
        public static TrackedItemSet LootedItems { get; } = new TrackedItemSet();
        public static HashSet<string> PlayerEquipmentIds { get; } = new HashSet<string>();
        public static Dictionary<string, int> PriceMap { get; set; }

        public static bool showUI { get; set; } = false;

        // 状态变量
        public static int CurrentLootValue { get;  set; }
        public const string PriceMapApiEndpoint = "/ShowLootValue/pullPriceMap";

        private void Awake()
        {
            var harmony = new Harmony("com.pricedisplay.plugin");
            harmony.PatchAll();

            // 初始化价格数据
            PriceMap = JsonConvert.DeserializeObject<Dictionary<string, int>>(
                PriceUtils.FetchPriceData("2001.11.13-2019.11.23"));

            // 配置物品追踪回调
            LootedItems.OnItemAdded = item =>
            {
                if (!PlayerEquipmentIds.Contains(item.Id))
                {
                    UpdateLootValue(PriceUtils.GetItemPrice(item.TemplateId) * item.StackObjectsCount);
                }
            };

            LootedItems.OnItemRemoved = item =>
            {
                if (!PlayerEquipmentIds.Contains(item.Id))
                {
                    int itemValue = PriceUtils.GetItemPrice(item.TemplateId) * item.StackObjectsCount;
                    UpdateLootValue(-Math.Min(itemValue, CurrentLootValue));
                }
            };
        }

        /// <summary>
        /// 更新战利品价值并刷新UI
        /// </summary>
        private static void UpdateLootValue(int delta)
        {
            CurrentLootValue += delta;
            if (ClonedRublesUI != null)
            {
                var textComponent = ClonedRublesUI.transform.Find("SlotName")
                    .GetComponent<TextMeshProUGUI>();
                textComponent.text = $"₽ {CurrentLootValue}";
            }
        }
    }

    /// <summary>
    /// 玩家添加物品时的处理
    /// </summary>
    [HarmonyPatch]
    public class PlayerItemAddedPatch
    {
        static MethodInfo TargetMethod() =>
            AccessTools.Method(AccessTools.TypeByName("Player"), "OnItemAdded");

        static void Postfix(object __instance, GEventArgs1 eventArgs)
        {
            if (ReferenceEquals(__instance, PriceDisplayPlugin.CurrentPlayer))
            {
                foreach (var item in eventArgs.Item.GetAllItems())
                {
                    PriceDisplayPlugin.LootedItems.Add(item);
                }
            }
        }
    }

    /// <summary>
    /// 玩家移除物品时的处理
    /// </summary>
    [HarmonyPatch]
    public class PlayerItemRemovedPatch
    {
        static MethodInfo TargetMethod() =>
            AccessTools.Method(AccessTools.TypeByName("Player"), "OnItemRemoved");

        static void Postfix(object __instance, GEventArgs3 eventArgs)
        {
            if (ReferenceEquals(__instance, PriceDisplayPlugin.CurrentPlayer))
            {
                foreach (var item in eventArgs.Item.GetAllItems())
                {
                    PriceDisplayPlugin.LootedItems.Remove(item);
                }
            }
        }
    }

    /// <summary>
    /// 容器界面显示时创建价值显示UI
    /// </summary>
    [HarmonyPatch(typeof(ContainersPanel), "Show")]
    public class ContainersUIPatch
    {
        public static void Postfix()
        {
            if (PriceDisplayPlugin.OriginalRublesUI == null)
            {
                PriceDisplayPlugin.OriginalRublesUI = GameObject.Find(
                    "Common UI/Common UI/InventoryScreen/Items Panel/LeftSide/" +
                    "Containers Panel/Scrollview Parent/Containers Scrollview/" +
                    "Content/TacticalVest Slot/Header Panel/SlotViewHeader/");

                if (PriceDisplayPlugin.OriginalRublesUI == null) return;
            }

            if (PriceDisplayPlugin.ClonedRublesUI == null && PriceDisplayPlugin.showUI)
            {
                CreateValueDisplayUI();
            }
        }

        /// <summary>
        /// 创建战利品价值显示UI组件
        /// </summary>
        private static void CreateValueDisplayUI()
        {
            PriceDisplayPlugin.ClonedRublesUI = UnityEngine.Object.Instantiate(
                PriceDisplayPlugin.OriginalRublesUI);

            PriceDisplayPlugin.ClonedRublesUI.transform.SetParent(
                PriceDisplayPlugin.OriginalRublesUI.transform.parent,
                false);

            // 调整UI位置和大小
            var rectTransform = PriceDisplayPlugin.ClonedRublesUI.GetComponent<RectTransform>();
            rectTransform.anchoredPosition3D += new Vector3(0, 36, 0);
            rectTransform.localScale = new Vector3(1.75f, 1.75f, 1);

            // 配置文本组件
            Transform arrow = PriceDisplayPlugin.ClonedRublesUI.transform.Find("ArrowHolder");
            arrow.gameObject.SetActive(false);

            var textComponent = PriceDisplayPlugin.ClonedRublesUI.transform.Find("SlotName")
                .GetComponent<TextMeshProUGUI>();
            textComponent.text = $"₽ {PriceDisplayPlugin.CurrentLootValue}";
            textComponent.horizontalAlignment = HorizontalAlignmentOptions.Left;
        }
    }

    /// <summary>
    /// 游戏开始时初始化玩家数据
    /// </summary>
    [HarmonyPatch(typeof(GameWorld), "OnGameStarted")]
    public class GameStartPatch
    {
        [HarmonyPostfix]
        public static void Postfix(GameWorld __instance)
        {
            PriceDisplayPlugin.CurrentPlayer = __instance.MainPlayer;
            PriceDisplayPlugin.showUI = true;
            var inventory = __instance.MainPlayer.Profile.Inventory;

            // 获取玩家装备ID
            PriceDisplayPlugin.PlayerEquipmentIds.Clear();
            foreach (var item in inventory.GetPlayerItems(EPlayerItems.Equipment))
            {
                PriceDisplayPlugin.PlayerEquipmentIds.Add(item.Id);
            }
        }
    }

    /// <summary>
    /// 游戏结束时重置状态
    /// </summary>
    [HarmonyPatch(typeof(SessionResultExitStatus), "Awake")]
    public class GameExitPatch
    {
        [HarmonyPostfix]
        public static void Postfix()
        {
            PriceDisplayPlugin.CurrentLootValue = 0;
            PriceDisplayPlugin.LootedItems.Clear();
            PriceDisplayPlugin.PlayerEquipmentIds.Clear();
            PriceDisplayPlugin.showUI = false;
        }
    }

    /// <summary>
    /// 物品追踪集合（自动处理添加/移除事件）
    /// </summary>
    public class TrackedItemSet
    {
        private readonly HashSet<string> _trackedIds = new HashSet<string>();

        public Action<Item> OnItemAdded { get; set; }
        public Action<Item> OnItemRemoved { get; set; }

        public bool Add(Item item)
        {
            if (_trackedIds.Add(item.Id))
            {
                OnItemAdded?.Invoke(item);
                return true;
            }
            return false;
        }

        public bool Remove(Item item)
        {
            if (_trackedIds.Remove(item.Id))
            {
                OnItemRemoved?.Invoke(item);
                return true;
            }
            return false;
        }

        public void Clear() => _trackedIds.Clear();
    }

    /// <summary>
    /// 价格工具类
    /// </summary>
    public static class PriceUtils
    {
        /// <summary>
        /// 从服务器获取价格数据
        /// </summary>
        public static string FetchPriceData(string request) =>
            RequestHandler.PostJson(PriceDisplayPlugin.PriceMapApiEndpoint,
                JsonConvert.SerializeObject(new PriceRequest(request)));

        /// <summary>
        /// 获取物品价格
        /// </summary>
        public static int GetItemPrice(string itemId) =>
            PriceDisplayPlugin.PriceMap.TryGetValue(itemId, out int price) ? price : 0;
    }

    /// <summary>
    /// 价格请求数据结构
    /// </summary>
    internal class PriceRequest
    {
        public PriceRequest(string request) => this.Request = request;
        public string Request { get; }
    }
}