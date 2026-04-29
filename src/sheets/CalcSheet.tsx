import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { View } from "react-native";
import { Sheet, SheetRef } from "../ui/Sheet";
import { Grouped } from "../ui/Grouped";
import { Row, RowEmpty } from "../ui/Row";
import { Segmented, FieldLabel } from "../ui/Controls";
import { TextField } from "../ui/TextField";
import { Prices, fetchPrices, getCachedPrices } from "../lib/prices";
import { fmtTRY, parseAmount } from "../lib/format";

type Unit = "try" | "usd" | "eur" | "gold";

const UNITS: { key: Unit; label: string }[] = [
  { key: "try", label: "TL" },
  { key: "usd", label: "$" },
  { key: "eur", label: "€" },
  { key: "gold", label: "Altın" },
];

const UNIT_LABEL: Record<Unit, string> = {
  try: "Türk Lirası",
  usd: "Dolar",
  eur: "Euro",
  gold: "Gram Altın",
};

export interface CalcSheetRef {
  open: () => void;
}

export const CalcSheet = forwardRef<CalcSheetRef>(function CalcSheet(_, ref) {
  const sheet = useRef<SheetRef>(null);
  const [amount, setAmount] = useState("1");
  const [from, setFrom] = useState<Unit>("usd");
  const [prices, setPrices] = useState<Prices | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      open() {
        sheet.current?.open();
      },
    }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    getCachedPrices().then((p) => {
      if (!cancelled && p) setPrices(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function rateInTry(unit: Unit, p: Prices): number {
    if (unit === "try") return 1;
    if (unit === "usd") return p.usd;
    if (unit === "eur") return p.eur;
    if (unit === "gold") return p.gold;
    return 0;
  }

  const conversions = useMemo(() => {
    if (!prices) return null;
    const a = parseAmount(amount) || 0;
    const fromRate = rateInTry(from, prices);
    if (fromRate <= 0 || a <= 0) return null;
    const tryValue = a * fromRate;
    return UNITS.filter((u) => u.key !== from).map((u) => {
      const r = rateInTry(u.key, prices);
      return {
        unit: u.key,
        label: UNIT_LABEL[u.key],
        value: r > 0 ? tryValue / r : 0,
      };
    });
  }, [prices, amount, from]);

  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const p = await fetchPrices(true);
      if (p) setPrices(p);
    } finally {
      setRefreshing(false);
    }
  }

  const updatedSub = prices
    ? `Güncel: ${new Date(prices.updatedAt).toLocaleString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : "Henüz fiyat yok";

  function formatUnit(unit: Unit, value: number): string {
    if (unit === "try") return fmtTRY(value);
    if (unit === "gold") return `${value.toFixed(4)} gr`;
    if (unit === "usd") return `${value.toFixed(2)} $`;
    if (unit === "eur") return `${value.toFixed(2)} €`;
    return value.toFixed(2);
  }

  return (
    <Sheet ref={sheet} title="Para Çevir" cancelLabel="Kapat">
      <Segmented<Unit>
        value={from}
        onChange={setFrom}
        options={UNITS.map((u) => ({ key: u.key, label: u.label }))}
      />

      <View>
        <FieldLabel>Miktar ({UNIT_LABEL[from]})</FieldLabel>
        <TextField
          inSheet
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0"
        />
      </View>

      <Grouped header="Karşılığı" footer={updatedSub}>
        {!conversions ? (
          <RowEmpty>
            {prices
              ? "Geçerli bir miktar girin."
              : "Önce fiyatları çekmeniz lazım."}
          </RowEmpty>
        ) : (
          conversions.map((c, i) => (
            <Row
              key={c.unit}
              title={c.label}
              value={formatUnit(c.unit, c.value)}
              isFirst={i === 0}
            />
          ))
        )}
        <Row
          icon="refresh"
          iconColor="blue"
          title={refreshing ? "Güncelleniyor…" : "Fiyatları Güncelle"}
          chevron
          onPress={refresh}
        />
      </Grouped>
    </Sheet>
  );
});
