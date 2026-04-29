import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Alert, View } from "react-native";
import { Sheet, SheetRef } from "../ui/Sheet";
import { Grouped } from "../ui/Grouped";
import { Row, RowEmpty } from "../ui/Row";
import { Segmented, FieldLabel, DestructiveButton } from "../ui/Controls";
import { TextField } from "../ui/TextField";
import { DateField } from "../ui/DateField";
import { Store, useStore } from "../store/store";
import { AssetKind } from "../store/types";
import { assetValue } from "../store/selectors";
import { fmtPct, fmtTRY, inputAmount, parseAmount, uid } from "../lib/format";
import { fetchPrices, getCachedPrices, priceForKind } from "../lib/prices";
import { notifyError, tapSoft } from "../lib/haptics";

const KIND_LABEL: Record<AssetKind, string> = {
  gold: "Altın",
  silver: "Gümüş",
  usd: "Dolar",
  eur: "Euro",
  other: "Diğer",
};

export interface AssetsSheetRef {
  open: (id?: string | null) => void;
}

export const AssetsSheet = forwardRef<AssetsSheetRef>(
  function AssetsSheet(_, ref) {
    const sheet = useRef<SheetRef>(null);
    const assets = useStore((s) => s.assets);
    const priceFetchedAt = useStore((s) => s.settings.priceFetchedAt);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState("");
    const [kind, setKind] = useState<AssetKind>("gold");
    const [amount, setAmount] = useState("");
    const [buyPrice, setBuyPrice] = useState("");
    const [currentPrice, setCurrentPrice] = useState("");
    const [buyDate, setBuyDate] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [livePrices, setLivePrices] = useState<{
      gold: number;
      usd: number;
      eur: number;
    } | null>(null);

    useEffect(() => {
      let cancelled = false;
      getCachedPrices().then((p) => {
        if (!cancelled && p)
          setLivePrices({ gold: p.gold, usd: p.usd, eur: p.eur });
      });
      return () => {
        cancelled = true;
      };
    }, []);

    async function refreshPrices() {
      if (refreshing) return;
      setRefreshing(true);
      try {
        const p = await fetchPrices(true);
        if (!p) {
          notifyError();
          Alert.alert(
            "Fiyatlar alınamadı",
            "İnternet bağlantınızı kontrol edin.",
          );
          return;
        }
        tapSoft();
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
        setLivePrices({ gold: p.gold, usd: p.usd, eur: p.eur });
      } finally {
        setRefreshing(false);
      }
    }

    useImperativeHandle(
      ref,
      () => ({
        open(id) {
          if (id) {
            const a = Store.state.assets.find((x) => x.id === id);
            if (!a) return;
            setEditingId(id);
            setEditing(true);
            setName(a.name);
            setKind(a.kind);
            setAmount(inputAmount(a.amount));
            setBuyPrice(inputAmount(a.buyPrice));
            setCurrentPrice(inputAmount(a.currentPrice ?? 0));
            setBuyDate(a.buyDate ?? null);
          } else {
            resetForm();
            setEditing(false);
          }
          sheet.current?.open();
        },
      }),
      [],
    );

    function resetForm() {
      setEditingId(null);
      setName("");
      setKind("gold");
      setAmount("");
      setBuyPrice("");
      setCurrentPrice("");
      setBuyDate(null);
    }

    function save() {
      const am = parseAmount(amount);
      const bp = parseAmount(buyPrice);
      const cp = parseAmount(currentPrice);
      if (!name.trim()) {
        Alert.alert("İsim girin");
        return;
      }
      if (!am || am <= 0) {
        Alert.alert("Miktar girin");
        return;
      }
      if (!bp || bp <= 0) {
        Alert.alert("Alış fiyatı girin");
        return;
      }
      Store.update((s) => {
        if (editingId) {
          const a = s.assets.find((x) => x.id === editingId);
          if (a)
            Object.assign(a, {
              name: name.trim(),
              kind,
              amount: am,
              buyPrice: bp,
              currentPrice: cp || null,
              buyDate,
            });
        } else {
          s.assets.push({
            id: uid(),
            name: name.trim(),
            kind,
            amount: am,
            buyPrice: bp,
            currentPrice: cp || null,
            buyDate,
          });
        }
      });
      resetForm();
      setEditing(false);
    }

    function remove(id: string) {
      Alert.alert("Sil", "Bu varlık silinsin mi?", [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: () => {
            Store.update((s) => {
              s.assets = s.assets.filter((a) => a.id !== id);
            });
            if (editingId === id) {
              resetForm();
              setEditing(false);
            }
          },
        },
      ]);
    }

    if (editing) {
      return (
        <Sheet
          ref={sheet}
          title={editingId ? "Varlığı Düzenle" : "Yeni Varlık"}
          actionLabel="Kaydet"
          onAction={save}
          cancelLabel="Geri"
          onCancel={() => {
            resetForm();
            setEditing(false);
          }}
        >
          <Segmented<AssetKind>
            value={kind}
            onChange={setKind}
            options={[
              { key: "gold", label: "Altın" },
              { key: "silver", label: "Gümüş" },
              { key: "usd", label: "$" },
              { key: "eur", label: "€" },
              { key: "other", label: "Diğer" },
            ]}
          />

          <View>
            <FieldLabel>İsim</FieldLabel>
            <TextField
              inSheet
              value={name}
              onChangeText={setName}
              placeholder="Çeyrek altın, THYAO…"
            />
          </View>

          <View>
            <FieldLabel>Miktar</FieldLabel>
            <TextField
              inSheet
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0"
            />
          </View>

          <View>
            <FieldLabel>Birim Alış Fiyatı (₺)</FieldLabel>
            <TextField
              inSheet
              value={buyPrice}
              onChangeText={setBuyPrice}
              keyboardType="decimal-pad"
              placeholder="0"
            />
          </View>

          <View>
            <FieldLabel>Birim Güncel Fiyatı (₺) — opsiyonel</FieldLabel>
            <TextField
              inSheet
              value={currentPrice}
              onChangeText={setCurrentPrice}
              keyboardType="decimal-pad"
              placeholder="Boş bırakırsan alış fiyatı"
            />
          </View>

          <View>
            <FieldLabel>Alış Tarihi</FieldLabel>
            <DateField value={buyDate} onChange={setBuyDate} />
          </View>

          {editingId && (
            <DestructiveButton
              label="Varlığı Sil"
              onPress={() => editingId && remove(editingId)}
            />
          )}
        </Sheet>
      );
    }

    const updatedLabel = priceFetchedAt
      ? `Güncellendi: ${new Date(priceFetchedAt).toLocaleString("tr-TR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })}`
      : "Henüz fiyat çekilmedi";

    return (
      <Sheet ref={sheet} title="Varlıklar" cancelLabel="Kapat">
        <Grouped header="Canlı Fiyat" footer={updatedLabel}>
          <Row
            title="Gram Altın"
            value={livePrices?.gold ? fmtTRY(livePrices.gold) : "—"}
            isFirst
          />
          <Row
            title="Dolar"
            value={livePrices?.usd ? fmtTRY(livePrices.usd) : "—"}
          />
          <Row
            title="Euro"
            value={livePrices?.eur ? fmtTRY(livePrices.eur) : "—"}
          />
          <Row
            icon="refresh"
            iconColor="blue"
            title={refreshing ? "Güncelleniyor…" : "Fiyatları Güncelle"}
            chevron
            onPress={refreshPrices}
          />
        </Grouped>

        <Grouped header="Tüm Varlıklar" footer="Kâr/zarar = güncel − alış">
          {assets.length === 0 ? (
            <RowEmpty>Henüz varlık yok.</RowEmpty>
          ) : (
            assets.map((a, i) => {
              const value = assetValue(a);
              const cost = a.amount * a.buyPrice;
              const pl = value - cost;
              const plPct = cost > 0 ? (pl / cost) * 100 : 0;
              return (
                <Row
                  key={a.id}
                  title={a.name}
                  sub={`${KIND_LABEL[a.kind]} · ${a.amount}`}
                  valueStack={{
                    value: fmtTRY(value),
                    sub: `${pl >= 0 ? "+" : ""}${fmtTRY(pl)} (${fmtPct(plPct)})`,
                    subTone: pl >= 0 ? "pos" : "neg",
                  }}
                  onPress={() => {
                    setEditingId(a.id);
                    setEditing(true);
                    setName(a.name);
                    setKind(a.kind);
                    setAmount(inputAmount(a.amount));
                    setBuyPrice(inputAmount(a.buyPrice));
                    setCurrentPrice(inputAmount(a.currentPrice ?? 0));
                    setBuyDate(a.buyDate ?? null);
                  }}
                  swipeActions={[
                    {
                      label: "Sil",
                      tone: "danger",
                      onPress: () => remove(a.id),
                    },
                  ]}
                  isFirst={i === 0}
                />
              );
            })
          )}
          <Row
            icon="plus"
            iconColor="blue"
            title="Yeni varlık"
            chevron
            onPress={() => {
              resetForm();
              setEditing(true);
            }}
            isFirst={assets.length === 0}
          />
        </Grouped>
      </Sheet>
    );
  },
);
