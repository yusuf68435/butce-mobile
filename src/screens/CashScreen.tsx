import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Navbar } from "../ui/Navbar";
import { Hero } from "../ui/Hero";
import { Pill } from "../ui/Controls";
import { PriceStrip } from "../ui/PriceStrip";
import { Grouped } from "../ui/Grouped";
import { Row, RowEmpty } from "../ui/Row";
import { ChartList, CHART_PALETTE } from "../ui/Chart";
import { ProgressBar, toneFromPct } from "../ui/ProgressBar";
import { Ring } from "../ui/Ring";
import { Alert } from "react-native";
import { Store, useStore } from "../store/store";
import { t as i18n } from "../lib/i18n";
import { fetchPrices, priceForKind } from "../lib/prices";
import {
  categorySpendOfMonth,
  chargeDueRecurring,
  nextDueOf,
  totalsOf,
  upcomingRecurring,
  wealthBreakdown,
  weeklyTotals,
} from "../store/selectors";
import { notifySuccess } from "../lib/haptics";
import { deletePhoto, isLocalPhoto } from "../lib/photos";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { STATE_VERSION } from "../lib/constants";
import {
  currentMonthKey,
  fmtDate,
  fmtMonthLabel,
  fmtTRY,
  prevMonthKey,
} from "../lib/format";
import { categoryMeta } from "../lib/constants";
import { useTheme } from "../theme/tokens";
import { TxSheet, TxSheetRef } from "../sheets/TxSheet";
import { MonthPickerSheet, MonthPickerRef } from "../sheets/MonthPickerSheet";
import { SettingsSheet, SettingsSheetRef } from "../sheets/SettingsSheet";
import {
  BudgetLimitSheet,
  BudgetLimitSheetRef,
} from "../sheets/BudgetLimitSheet";
import { RecurringSheet, RecurringSheetRef } from "../sheets/RecurringSheet";
import { GoalSheet, GoalSheetRef } from "../sheets/GoalSheet";
import { SearchSheet, SearchSheetRef } from "../sheets/SearchSheet";
import { TrendsSheet, TrendsSheetRef } from "../sheets/TrendsSheet";
import { AssetsSheet, AssetsSheetRef } from "../sheets/AssetsSheet";
import { DebtsSheet, DebtsSheetRef } from "../sheets/DebtsSheet";
import { InsightsSheet, InsightsSheetRef } from "../sheets/InsightsSheet";
import { CalendarSheet, CalendarSheetRef } from "../sheets/CalendarSheet";
import { CalcSheet, CalcSheetRef } from "../sheets/CalcSheet";
import { TemplatesSheet, TemplatesSheetRef } from "../sheets/TemplatesSheet";
import { CategoriesSheet, CategoriesSheetRef } from "../sheets/CategoriesSheet";
import {
  AutoBackupsSheet,
  AutoBackupsSheetRef,
} from "../sheets/AutoBackupsSheet";
import {
  DiagnosticsSheet,
  DiagnosticsSheetRef,
} from "../sheets/DiagnosticsSheet";
import { PendingSheet, PendingSheetRef } from "../sheets/PendingSheet";
import { CollectSheet, CollectSheetRef } from "../sheets/CollectSheet";

export function CashScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const state = useStore((s) => s);
  const [viewMonth, setViewMonth] = useState<string>(currentMonthKey());

  const txSheet = useRef<TxSheetRef>(null);
  const monthSheet = useRef<MonthPickerRef>(null);
  const settingsSheet = useRef<SettingsSheetRef>(null);
  const limitSheet = useRef<BudgetLimitSheetRef>(null);
  const recurringSheet = useRef<RecurringSheetRef>(null);
  const goalSheet = useRef<GoalSheetRef>(null);
  const searchSheet = useRef<SearchSheetRef>(null);
  const trendsSheet = useRef<TrendsSheetRef>(null);
  const assetsSheet = useRef<AssetsSheetRef>(null);
  const debtsSheet = useRef<DebtsSheetRef>(null);
  const insightsSheet = useRef<InsightsSheetRef>(null);
  const calendarSheet = useRef<CalendarSheetRef>(null);
  const calcSheet = useRef<CalcSheetRef>(null);
  const templatesSheet = useRef<TemplatesSheetRef>(null);
  const categoriesSheet = useRef<CategoriesSheetRef>(null);
  const autoBackupsSheet = useRef<AutoBackupsSheetRef>(null);
  const diagnosticsSheet = useRef<DiagnosticsSheetRef>(null);
  const pendingSheet = useRef<PendingSheetRef>(null);
  const collectSheet = useRef<CollectSheetRef>(null);

  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const p = await fetchPrices(true);
      if (p) {
        Store.update((s) => {
          for (const a of s.assets) {
            if (
              a.kind === "gold" ||
              a.kind === "silver" ||
              a.kind === "usd" ||
              a.kind === "eur"
            ) {
              const price = priceForKind(p, a.kind);
              if (price > 0) a.currentPrice = price;
            }
          }
          s.settings.priceFetchedAt = p.updatedAt;
        });
      }
      let chargedCount = 0;
      Store.update((s) => {
        const r = chargeDueRecurring(s);
        chargedCount = r.txCreated;
      });
      void chargedCount; // currently informational; could surface a toast later
      notifySuccess();
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const hasPriceableAsset = state.assets.some(
      (a) =>
        a.kind === "gold" ||
        a.kind === "silver" ||
        a.kind === "usd" ||
        a.kind === "eur",
    );
    if (!hasPriceableAsset) return;
    fetchPrices(false).then((p) => {
      if (cancelled || !p) return;
      Store.update((s) => {
        for (const a of s.assets) {
          if (
            a.kind === "gold" ||
            a.kind === "silver" ||
            a.kind === "usd" ||
            a.kind === "eur"
          ) {
            const price = priceForKind(p, a.kind);
            if (price > 0) a.currentPrice = price;
          }
        }
        s.settings.priceFetchedAt = p.updatedAt;
      });
    });
    return () => {
      cancelled = true;
    };
    // Effect runs once on mount; price fetch is one-shot per session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => totalsOf(state, viewMonth), [state, viewMonth]);
  const wealth = useMemo(() => wealthBreakdown(state), [state]);
  const limits = useMemo(
    () => categorySpendOfMonth(state, viewMonth),
    [state, viewMonth],
  );

  const sortedTx = useMemo(
    () =>
      [...totals.list].sort(
        (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
      ),
    [totals.list],
  );

  const expenseChart = useMemo(() => {
    const expenses = totals.list.filter((x) => x.type === "expense");
    if (!expenses.length) return [];
    const byCat = new Map<string, number>();
    for (const x of expenses)
      byCat.set(x.category, (byCat.get(x.category) || 0) + x.amount);
    const total = [...byCat.values()].reduce((a, b) => a + b, 0);
    return [...byCat.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, amt], i) => ({
        name,
        amount: fmtTRY(amt),
        pct: (amt / total) * 100,
        color: CHART_PALETTE[i % CHART_PALETTE.length],
      }));
  }, [totals.list]);

  return (
    <View style={[styles.root, { backgroundColor: t.bg.grouped }]}>
      <View style={{ paddingTop: insets.top }}>
        <Navbar
          title="Bütçe"
          leading={[
            {
              icon: "gear",
              onPress: () => settingsSheet.current?.open(),
              onLongPress: async () => {
                try {
                  const today = new Date().toISOString().slice(0, 10);
                  const fileUri =
                    FileSystem.cacheDirectory + `butce-yedek-${today}.json`;
                  const payload = {
                    app: "ggai",
                    version: STATE_VERSION,
                    exportedAt: new Date().toISOString(),
                    state: Store.state,
                  };
                  await FileSystem.writeAsStringAsync(
                    fileUri,
                    JSON.stringify(payload),
                  );
                  Store.update((s) => {
                    s.settings.lastBackup = today;
                  });
                  notifySuccess();
                  if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(fileUri, {
                      mimeType: "application/json",
                      dialogTitle: "Bütçe yedeği",
                      UTI: "public.json",
                    });
                  } else {
                    Alert.alert("Yedek hazır", `Dosya: ${fileUri}`);
                  }
                } catch (e: unknown) {
                  Alert.alert(
                    "Yedek hatası",
                    e instanceof Error ? e.message : "",
                  );
                }
              },
            },
            {
              icon: "chart",
              onPress: () => trendsSheet.current?.open(),
            },
            {
              icon: "sparkles",
              onPress: () => insightsSheet.current?.open(),
            },
          ]}
          trailing={[
            {
              icon: "calendar",
              onPress: () => calendarSheet.current?.open(),
            },
            {
              icon: "search",
              onPress: () => searchSheet.current?.open(),
            },
            {
              icon: "plus",
              onPress: () => {
                if (state.templates.length === 0) {
                  txSheet.current?.open(null);
                  return;
                }
                Alert.alert("Yeni hareket", undefined, [
                  {
                    text: "Boş hareket",
                    onPress: () => txSheet.current?.open(null),
                  },
                  {
                    text: "Şablondan",
                    onPress: () => templatesSheet.current?.open(),
                  },
                  { text: "Vazgeç", style: "cancel" },
                ]);
              },
              onLongPress: () => templatesSheet.current?.open(),
            },
          ]}
        />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 96 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={t.tint}
          />
        }
      >
        <Hero
          eyebrow={i18n("hero.balance")}
          amount={fmtTRY(totals.balance)}
          meta={(() => {
            const meta: { label: string; tone?: "pos" | "neg" }[] = [
              {
                label: `+${fmtTRY(totals.income).replace("-", "")}`,
                tone: "pos",
              },
              {
                label: `−${fmtTRY(totals.expense).replace("-", "")}`,
                tone: "neg",
              },
            ];
            // Month-over-month: previous month expense for comparison
            const prevExp = totalsOf(state, prevMonthKey(viewMonth)).expense;
            if (prevExp > 0 && totals.expense > 0) {
              const delta = ((totals.expense - prevExp) / prevExp) * 100;
              if (Math.abs(delta) >= 5) {
                meta.push({
                  label: `${delta >= 0 ? "▲" : "▼"} %${Math.abs(Math.round(delta))}`,
                  tone: delta >= 0 ? "neg" : "pos",
                });
              }
            }
            return meta;
          })()}
        />

        <PriceStrip onPress={() => calcSheet.current?.open()} />

        <Pill
          label={fmtMonthLabel(viewMonth)}
          onPress={() => monthSheet.current?.open(viewMonth)}
        />

        {(() => {
          const wk = weeklyTotals(state);
          if (wk.income === 0 && wk.expense === 0) return null;
          return (
            <View style={styles.weekBar}>
              <Text
                style={{
                  color: t.label.tertiary,
                  fontSize: 11,
                  fontWeight: "500",
                  letterSpacing: 0.66,
                }}
              >
                SON 7 GÜN
              </Text>
              <Text
                style={{
                  color: t.green,
                  fontSize: 13,
                  fontWeight: "600",
                  fontVariant: ["tabular-nums"],
                  letterSpacing: -0.2,
                }}
              >
                +{fmtTRY(wk.income).replace("-", "")}
              </Text>
              <Text
                style={{
                  color: t.label.quaternary,
                  fontSize: 12,
                }}
              >
                •
              </Text>
              <Text
                style={{
                  color: t.red,
                  fontSize: 13,
                  fontWeight: "600",
                  fontVariant: ["tabular-nums"],
                  letterSpacing: -0.2,
                }}
              >
                −{fmtTRY(wk.expense).replace("-", "")}
              </Text>
            </View>
          );
        })()}

        <Grouped header="Toplam Servet">
          <Row
            icon="wallet"
            iconColor="blue"
            title="Toplam"
            sub="Nakit + Varlıklar + Bekleyen ± Borç"
            value={fmtTRY(wealth.total)}
            valueBold
            isFirst
          />
          <Row
            icon="cash"
            iconColor="green"
            title="Nakit"
            value={fmtTRY(wealth.cash)}
            valueTone={wealth.cash >= 0 ? "default" : "neg"}
          />
          <Row
            icon="sparkles"
            iconColor="purple"
            title="Varlıklar"
            sub="Altın, gümüş, döviz"
            value={fmtTRY(wealth.assets)}
            valueTone="muted"
            chevron
            onPress={() => assetsSheet.current?.open(null)}
          />
          {wealth.pending > 0 && (
            <Row
              icon="hourglass"
              iconColor="orange"
              title="Bekleyen"
              value={fmtTRY(wealth.pending)}
              valueTone="muted"
              chevron
              onPress={() => pendingSheet.current?.open(null)}
            />
          )}
          {wealth.debts !== 0 && (
            <Row
              icon="briefcase"
              iconColor={wealth.debts >= 0 ? "green" : "red"}
              title="Borç/Alacak"
              sub={wealth.debts >= 0 ? "Net alacaklı" : "Net borçlu"}
              value={fmtTRY(wealth.debts)}
              valueTone={wealth.debts >= 0 ? "pos" : "neg"}
              chevron
              onPress={() => debtsSheet.current?.open(null)}
            />
          )}
        </Grouped>

        {expenseChart.length > 0 && (
          <Grouped header="Gider Dağılımı">
            <ChartList items={expenseChart} />
          </Grouped>
        )}

        <Grouped header="Bütçe Limitleri" footer="Tıklayarak düzenle">
          {limits.length === 0 ? (
            <RowEmpty>Henüz limit yok.</RowEmpty>
          ) : (
            limits.map((r, i) => {
              const meta = categoryMeta(r.category);
              const tone = toneFromPct(r.pct);
              return (
                <View key={r.category}>
                  <Row
                    icon={meta.icon}
                    iconColor={meta.color}
                    title={r.category}
                    sub={`${fmtTRY(r.spent)} / ${fmtTRY(r.limit)}`}
                    rightSlot={
                      <View style={{ marginLeft: 6 }}>
                        <Ring
                          pct={r.pct / 100}
                          size={32}
                          tone={
                            tone === "over"
                              ? "bad"
                              : tone === "warn"
                                ? "warn"
                                : "good"
                          }
                        />
                      </View>
                    }
                    onPress={() => limitSheet.current?.open(r.category)}
                    isFirst={i === 0}
                  />
                </View>
              );
            })
          )}
          <Row
            icon="plus"
            iconColor="blue"
            title="Yeni limit"
            chevron
            onPress={() => limitSheet.current?.open(null)}
            isFirst={limits.length === 0}
          />
        </Grouped>

        <Grouped
          header="Abonelikler"
          footer={(() => {
            const upcoming = upcomingRecurring(state, 7);
            if (upcoming.length === 0) return "Otomatik işlenir";
            const sum = upcoming.reduce(
              (a, u) =>
                a +
                (u.recurring.type === "expense"
                  ? u.recurring.amount
                  : -u.recurring.amount),
              0,
            );
            return `7 gün içinde ${upcoming.length} işlem · net çıkış ${fmtTRY(sum)}`;
          })()}
        >
          {state.recurring.length === 0 ? (
            <Row
              icon="plus"
              iconColor="blue"
              title="Abonelik ekle"
              chevron
              onPress={() => recurringSheet.current?.open(null)}
              isFirst
            />
          ) : (
            <>
              {state.recurring.slice(0, 4).map((r, i) => {
                const meta = categoryMeta(r.category);
                const due = nextDueOf(r);
                const sign = r.type === "income" ? "+" : "−";
                return (
                  <Row
                    key={r.id}
                    icon={meta.icon}
                    iconColor={meta.color}
                    title={r.name}
                    sub={`Sıradaki ${fmtDate(due)}`}
                    value={`${sign}${fmtTRY(r.amount).replace("-", "")}`}
                    valueTone={
                      r.active
                        ? r.type === "income"
                          ? "pos"
                          : "default"
                        : "muted"
                    }
                    onPress={() => recurringSheet.current?.open(r.id)}
                    isFirst={i === 0}
                  />
                );
              })}
              <Row
                icon="plus"
                iconColor="blue"
                title={
                  state.recurring.length > 4
                    ? `Tümünü gör (${state.recurring.length})`
                    : "Abonelik ekle"
                }
                chevron
                onPress={() => recurringSheet.current?.open(null)}
              />
            </>
          )}
        </Grouped>

        <Grouped header="Hedefler">
          {state.goals.length === 0 ? (
            <Row
              icon="plus"
              iconColor="blue"
              title="Hedef ekle"
              chevron
              onPress={() => goalSheet.current?.open(null)}
              isFirst
            />
          ) : (
            <>
              {state.goals.slice(0, 3).map((g, i) => {
                const pct = g.target > 0 ? (g.saved / g.target) * 100 : 0;
                return (
                  <View key={g.id}>
                    <Row
                      title={g.name}
                      sub={`${fmtTRY(g.saved)} / ${fmtTRY(g.target)}`}
                      valueStack={{
                        value: `${Math.round(Math.min(pct, 999))}%`,
                        sub: g.deadline ? fmtDate(g.deadline) : "",
                        subTone: "muted",
                      }}
                      onPress={() => goalSheet.current?.open(g.id)}
                      isFirst={i === 0}
                    />
                    <View
                      style={{
                        backgroundColor: t.bg.elev,
                        paddingHorizontal: 16,
                        paddingBottom: 10,
                      }}
                    >
                      <ProgressBar pct={Math.min(pct, 100)} />
                    </View>
                  </View>
                );
              })}
              <Row
                icon="plus"
                iconColor="blue"
                title={
                  state.goals.length > 3
                    ? `Tümünü gör (${state.goals.length})`
                    : "Hedef ekle"
                }
                chevron
                onPress={() => goalSheet.current?.open(null)}
              />
            </>
          )}
        </Grouped>

        {state.pending.length > 0 && (
          <Grouped
            header="Bekleyenler"
            footer="Geldiğinde sağa kaydır → Tahsil et"
          >
            {state.pending.map((p, i) => (
              <Row
                key={p.id}
                icon="hourglass"
                iconColor="orange"
                title={p.source}
                sub={p.exactDate ? fmtDate(p.exactDate) : "Tarih belirsiz"}
                value={fmtTRY(p.amount)}
                valueBold
                onPress={() => pendingSheet.current?.open(p.id)}
                swipeActions={[
                  {
                    label: "Sil",
                    tone: "danger",
                    onPress: () => {
                      Store.update((s) => {
                        s.pending = s.pending.filter((x) => x.id !== p.id);
                      });
                    },
                  },
                  {
                    label: "Tahsil",
                    tone: "primary",
                    onPress: () => collectSheet.current?.open(p.id),
                  },
                ]}
                isFirst={i === 0}
              />
            ))}
            <Row
              icon="plus"
              iconColor="orange"
              title="Yeni bekleyen"
              chevron
              onPress={() => pendingSheet.current?.open(null)}
            />
          </Grouped>
        )}

        <Grouped
          header="Hareketler"
          footer={
            sortedTx.length > 100
              ? `${sortedTx.length} hareket — ilk 100 gösteriliyor`
              : undefined
          }
        >
          {sortedTx.length === 0 ? (
            <RowEmpty
              icon="cash"
              iconColor="green"
              cta={{
                label: "İlk hareketini ekle",
                onPress: () => txSheet.current?.open(null),
              }}
            >
              Bu ay henüz hareket yok.
            </RowEmpty>
          ) : (
            <>
              {sortedTx.slice(0, 100).map((tx, i) => {
                const meta = categoryMeta(tx.category);
                const sign = tx.type === "income" ? "+" : "−";
                const sub = tx.description
                  ? `${tx.description} · ${fmtDate(tx.date)}`
                  : fmtDate(tx.date);
                const showContextMenu = () => {
                  Alert.alert(tx.category, sub, [
                    {
                      text: "Düzenle",
                      onPress: () => txSheet.current?.open(tx.id),
                    },
                    {
                      text: "Kopyala",
                      onPress: () => {
                        Store.update((s) => {
                          s.transactions.push({
                            ...tx,
                            id: `${tx.id}-copy-${Date.now()}`,
                            date: new Date().toISOString().slice(0, 10),
                          });
                        });
                      },
                    },
                    {
                      text: "Sil",
                      style: "destructive",
                      onPress: () => {
                        if (tx.photoUri && isLocalPhoto(tx.photoUri)) {
                          deletePhoto(tx.photoUri);
                        }
                        Store.update((s) => {
                          s.transactions = s.transactions.filter(
                            (x) => x.id !== tx.id,
                          );
                        });
                      },
                    },
                    { text: "Vazgeç", style: "cancel" },
                  ]);
                };
                return (
                  <Row
                    key={tx.id}
                    icon={meta.icon}
                    iconColor={meta.color}
                    title={tx.category}
                    sub={sub}
                    value={`${sign}${fmtTRY(tx.amount).replace("-", "")}`}
                    valueTone={tx.type === "income" ? "pos" : "default"}
                    thumbUri={tx.photoUri ?? null}
                    onPress={() => txSheet.current?.open(tx.id)}
                    onLongPress={showContextMenu}
                    swipeActions={[
                      {
                        label: "Sil",
                        tone: "danger",
                        onPress: () => {
                          if (tx.photoUri && isLocalPhoto(tx.photoUri)) {
                            deletePhoto(tx.photoUri);
                          }
                          Store.update((s) => {
                            s.transactions = s.transactions.filter(
                              (x) => x.id !== tx.id,
                            );
                          });
                        },
                      },
                      {
                        label: "Düzenle",
                        tone: "primary",
                        onPress: () => txSheet.current?.open(tx.id),
                      },
                    ]}
                    isFirst={i === 0}
                  />
                );
              })}
              {sortedTx.length > 100 && (
                <Row
                  icon="search"
                  iconColor="blue"
                  title="Tümünü ara…"
                  chevron
                  onPress={() => searchSheet.current?.open()}
                />
              )}
            </>
          )}
        </Grouped>
      </ScrollView>

      <TxSheet ref={txSheet} />
      <MonthPickerSheet ref={monthSheet} onSelect={setViewMonth} />
      <SettingsSheet
        ref={settingsSheet}
        onOpenCategories={() => categoriesSheet.current?.open()}
        onOpenAutoBackups={() => autoBackupsSheet.current?.open()}
        onOpenDiagnostics={() => diagnosticsSheet.current?.open()}
      />
      <BudgetLimitSheet ref={limitSheet} />
      <RecurringSheet ref={recurringSheet} />
      <GoalSheet ref={goalSheet} />
      <SearchSheet ref={searchSheet} txSheet={txSheet} />
      <TrendsSheet ref={trendsSheet} />
      <AssetsSheet ref={assetsSheet} />
      <DebtsSheet ref={debtsSheet} />
      <InsightsSheet ref={insightsSheet} />
      <CalendarSheet ref={calendarSheet} txSheet={txSheet} />
      <CalcSheet ref={calcSheet} />
      <TemplatesSheet ref={templatesSheet} />
      <CategoriesSheet ref={categoriesSheet} />
      <AutoBackupsSheet ref={autoBackupsSheet} />
      <DiagnosticsSheet ref={diagnosticsSheet} />
      <PendingSheet ref={pendingSheet} />
      <CollectSheet ref={collectSheet} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 16 },
  weekBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: -4,
  },
});
