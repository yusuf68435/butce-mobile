import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, Pressable, Text } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Sheet, SheetRef } from "../ui/Sheet";
import { Grouped } from "../ui/Grouped";
import { Row, RowEmpty } from "../ui/Row";
import { Segmented } from "../ui/Controls";
import { MonthlyBars } from "../ui/MonthlyBars";
import { useStore } from "../store/store";
import { monthlyTotals, yearlySummary } from "../store/selectors";
import { categoryMeta } from "../lib/constants";
import { fmtMonthLabel, fmtTRY, todayISO } from "../lib/format";
import { useTheme } from "../theme/tokens";

export interface TrendsSheetRef {
  open: () => void;
}

type Range = "12m" | "6m" | "ytd";

export const TrendsSheet = forwardRef<TrendsSheetRef>(
  function TrendsSheet(_, ref) {
    const sheet = useRef<SheetRef>(null);
    const t = useTheme();
    const transactions = useStore((s) => s.transactions);
    const [range, setRange] = useState<Range>("12m");

    useImperativeHandle(
      ref,
      () => ({
        open() {
          setRange("12m");
          sheet.current?.open();
        },
      }),
      [],
    );

    const months = useMemo(() => {
      const count =
        range === "6m" ? 6 : range === "ytd" ? new Date().getMonth() + 1 : 12;
      return monthlyTotals({ transactions }, count);
    }, [transactions, range]);

    const totals = useMemo(() => {
      const inc = months.reduce((a, m) => a + m.income, 0);
      const exp = months.reduce((a, m) => a + m.expense, 0);
      return { income: inc, expense: exp, net: inc - exp };
    }, [months]);

    const year = new Date().getFullYear();
    const yearly = useMemo(
      () => yearlySummary({ transactions }, year),
      [transactions, year],
    );

    const bestMonth = useMemo(
      () =>
        months.length
          ? months.reduce((b, m) => (m.net > b.net ? m : b), months[0])
          : null,
      [months],
    );
    const worstMonth = useMemo(
      () =>
        months.length
          ? months.reduce((b, m) => (m.net < b.net ? m : b), months[0])
          : null,
      [months],
    );

    async function shareSummary() {
      try {
        const lines: string[] = [];
        lines.push("Bütçe — Yıllık Özet");
        lines.push(`Yıl: ${year}`);
        lines.push(`Gelir: ${fmtTRY(yearly.income)}`);
        lines.push(`Gider: ${fmtTRY(yearly.expense)}`);
        lines.push(`Net: ${fmtTRY(yearly.net)}`);
        lines.push("");
        lines.push("En çok harcanan kategoriler:");
        yearly.topCategories.forEach((c, i) => {
          lines.push(`${i + 1}. ${c.category} — ${fmtTRY(c.amount)}`);
        });
        lines.push("");
        lines.push("Aylık döküm:");
        months.forEach((m) => {
          lines.push(
            `${m.key}: gelir ${fmtTRY(m.income)} · gider ${fmtTRY(m.expense)} · net ${fmtTRY(m.net)}`,
          );
        });
        const txt = lines.join("\n");
        const uri = FileSystem.cacheDirectory + `butce-ozet-${todayISO()}.txt`;
        await FileSystem.writeAsStringAsync(uri, txt);
        const can = await Sharing.isAvailableAsync();
        if (can) {
          await Sharing.shareAsync(uri, {
            mimeType: "text/plain",
            dialogTitle: "Özeti paylaş",
          });
        } else {
          Alert.alert("Özet hazır", txt);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "";
        Alert.alert("Paylaşım hatası", msg);
      }
    }

    return (
      <Sheet ref={sheet} title="Trend" cancelLabel="Kapat">
        <Segmented<Range>
          value={range}
          onChange={setRange}
          options={[
            { key: "6m", label: "6 Ay" },
            { key: "12m", label: "12 Ay" },
            { key: "ytd", label: "Bu Yıl" },
          ]}
        />

        {months.length > 0 ? (
          <MonthlyBars data={months} />
        ) : (
          <RowEmpty>Veri yok.</RowEmpty>
        )}

        <Grouped header="Toplam">
          <Row
            title="Gelir"
            value={fmtTRY(totals.income)}
            valueTone="pos"
            isFirst
          />
          <Row title="Gider" value={fmtTRY(totals.expense)} valueTone="neg" />
          <Row
            title="Net"
            value={fmtTRY(totals.net)}
            valueTone={totals.net >= 0 ? "pos" : "neg"}
            valueBold
          />
        </Grouped>

        {bestMonth && worstMonth && (
          <Grouped header="Öne Çıkanlar">
            <Row
              icon="arrow-up"
              iconColor="green"
              title="En iyi ay"
              sub={fmtMonthLabel(bestMonth.key)}
              value={fmtTRY(bestMonth.net)}
              valueTone="pos"
              isFirst
            />
            <Row
              icon="arrow-down"
              iconColor="red"
              title="En zayıf ay"
              sub={fmtMonthLabel(worstMonth.key)}
              value={fmtTRY(worstMonth.net)}
              valueTone="neg"
            />
          </Grouped>
        )}

        <Grouped header={`${year} Yıllık`} footer="En çok harcanan kategoriler">
          <Row
            title="Toplam Gelir"
            value={fmtTRY(yearly.income)}
            valueTone="pos"
            isFirst
          />
          <Row
            title="Toplam Gider"
            value={fmtTRY(yearly.expense)}
            valueTone="neg"
          />
          <Row
            title="Yıl Sonu Net"
            value={fmtTRY(yearly.net)}
            valueTone={yearly.net >= 0 ? "pos" : "neg"}
            valueBold
          />
          {yearly.topCategories.map((c) => {
            const meta = categoryMeta(c.category);
            return (
              <Row
                key={c.category}
                icon={meta.icon}
                iconColor={meta.color}
                title={c.category}
                value={fmtTRY(c.amount)}
                valueTone="default"
              />
            );
          })}
        </Grouped>

        <Pressable
          onPress={shareSummary}
          style={({ pressed }) => ({
            backgroundColor: pressed ? t.bg.fill : t.bg.elev,
            padding: 13,
            borderRadius: 12,
            alignItems: "center",
          })}
        >
          <Text style={{ color: t.tint, fontSize: 17 }}>Özeti Paylaş</Text>
        </Pressable>
      </Sheet>
    );
  },
);
