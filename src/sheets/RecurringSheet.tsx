import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Alert, Switch, View } from "react-native";
import { Sheet, SheetRef } from "../ui/Sheet";
import { Grouped } from "../ui/Grouped";
import { Row, RowEmpty } from "../ui/Row";
import {
  Segmented,
  Chip,
  ChipGrid,
  FieldLabel,
  DestructiveButton,
} from "../ui/Controls";
import { TextField } from "../ui/TextField";
import { DateField } from "../ui/DateField";
import { Store, useStore } from "../store/store";
import { Period, TxType } from "../store/types";
import { categoryMeta } from "../lib/constants";
import { fmtTRY, inputAmount, parseAmount, todayISO, uid } from "../lib/format";
import { nextDueOf } from "../store/selectors";
export interface RecurringSheetRef {
  open: (id?: string | null) => void;
}

export const RecurringSheet = forwardRef<RecurringSheetRef>(
  function RecurringSheet(_, ref) {
    const sheet = useRef<SheetRef>(null);
    const recurring = useStore((s) => s.recurring);
    const categories = useStore((s) => s.categories);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editing, setEditing] = useState(false);
    const [type, setType] = useState<TxType>("expense");
    const [name, setName] = useState("");
    const [category, setCategory] = useState<string | null>(null);
    const [amount, setAmount] = useState("");
    const [period, setPeriod] = useState<Period>("monthly");
    const [startDate, setStartDate] = useState<string>(todayISO());
    const [active, setActive] = useState(true);

    useImperativeHandle(
      ref,
      () => ({
        open(id) {
          if (id) {
            const r = Store.state.recurring.find((x) => x.id === id);
            if (!r) return;
            setEditingId(id);
            setEditing(true);
            setType(r.type);
            setName(r.name);
            setCategory(r.category);
            setAmount(inputAmount(r.amount));
            setPeriod(r.period);
            setStartDate(r.startDate);
            setActive(r.active);
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
      setType("expense");
      setName("");
      setCategory(null);
      setAmount("");
      setPeriod("monthly");
      setStartDate(todayISO());
      setActive(true);
    }

    function save() {
      const a = parseAmount(amount);
      if (!name.trim()) {
        Alert.alert("İsim girin");
        return;
      }
      if (!category) {
        Alert.alert("Kategori seçin");
        return;
      }
      if (!a || a <= 0) {
        Alert.alert("Tutar girin");
        return;
      }
      Store.update((s) => {
        if (editingId) {
          const r = s.recurring.find((x) => x.id === editingId);
          if (r)
            Object.assign(r, {
              type,
              name: name.trim(),
              category,
              amount: a,
              period,
              startDate,
              active,
            });
        } else {
          s.recurring.push({
            id: uid(),
            type,
            name: name.trim(),
            category,
            amount: a,
            period,
            startDate,
            lastChargedDate: null,
            active,
          });
        }
      });
      resetForm();
      setEditing(false);
    }

    function remove(id: string) {
      Alert.alert("Sil", "Bu tekrarlayan kalem silinsin mi?", [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: () => {
            Store.update((s) => {
              s.recurring = s.recurring.filter((r) => r.id !== id);
            });
            if (editingId === id) {
              resetForm();
              setEditing(false);
            }
          },
        },
      ]);
    }

    function toggle(id: string) {
      Store.update((s) => {
        const r = s.recurring.find((x) => x.id === id);
        if (r) r.active = !r.active;
      });
    }

    function skipNext(id: string) {
      Store.update((s) => {
        const r = s.recurring.find((x) => x.id === id);
        if (!r) return;
        // Move lastChargedDate forward by one period so chargeDueRecurring
        // skips the upcoming due date without creating a transaction.
        const due = nextDueOf(r);
        r.lastChargedDate = due;
      });
    }

    function payNow(id: string) {
      Store.update((s) => {
        const r = s.recurring.find((x) => x.id === id);
        if (!r) return;
        const due = nextDueOf(r);
        s.transactions.push({
          id: `${r.id}-${Date.now()}`,
          type: r.type,
          category: r.category,
          description: r.name,
          amount: r.amount,
          date: due,
        });
        r.lastChargedDate = due;
      });
    }

    if (editing) {
      return (
        <Sheet
          ref={sheet}
          title={editingId ? "Tekrarlayanı Düzenle" : "Yeni Abonelik"}
          actionLabel="Kaydet"
          onAction={save}
          cancelLabel="Geri"
          onCancel={() => {
            resetForm();
            setEditing(false);
          }}
        >
          <Segmented<TxType>
            value={type}
            onChange={(v) => {
              setType(v);
              setCategory(null);
            }}
            options={[
              { key: "expense", label: "Gider" },
              { key: "income", label: "Gelir" },
            ]}
          />

          <View>
            <FieldLabel>İsim</FieldLabel>
            <TextField
              inSheet
              value={name}
              onChangeText={setName}
              placeholder="Netflix, Spotify, kira…"
            />
          </View>

          <View>
            <FieldLabel>Tutar</FieldLabel>
            <TextField
              inSheet
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0"
            />
          </View>

          <View>
            <FieldLabel>Kategori</FieldLabel>
            <ChipGrid>
              {categories[type].map((c) => (
                <Chip
                  key={c}
                  label={c}
                  active={c === category}
                  onPress={() => setCategory(c)}
                />
              ))}
            </ChipGrid>
          </View>

          <View>
            <FieldLabel>Sıklık</FieldLabel>
            <Segmented<Period>
              value={period}
              onChange={setPeriod}
              options={[
                { key: "weekly", label: "Haftalık" },
                { key: "monthly", label: "Aylık" },
                { key: "yearly", label: "Yıllık" },
              ]}
            />
          </View>

          <View>
            <FieldLabel>Başlangıç</FieldLabel>
            <DateField
              value={startDate}
              onChange={(d) => setStartDate(d || todayISO())}
            />
          </View>

          <Grouped>
            <Row
              title="Aktif"
              sub={active ? "Otomatik işlenecek" : "Duraklatıldı"}
              isFirst
              rightSlot={<Switch value={active} onValueChange={setActive} />}
            />
          </Grouped>

          {editingId && (
            <DestructiveButton
              label="Sil"
              onPress={() => editingId && remove(editingId)}
            />
          )}
        </Sheet>
      );
    }

    return (
      <Sheet ref={sheet} title="Tekrarlayanlar" cancelLabel="Kapat">
        <Grouped header="Abonelikler ve Düzenli Ödemeler">
          {recurring.length === 0 ? (
            <RowEmpty>Henüz tekrarlayan kalem yok.</RowEmpty>
          ) : (
            recurring.map((r, i) => {
              const meta = categoryMeta(r.category);
              const due = nextDueOf(r);
              const sub = `${
                r.period === "weekly"
                  ? "Haftalık"
                  : r.period === "yearly"
                    ? "Yıllık"
                    : "Aylık"
              } · sıradaki ${due}`;
              const sign = r.type === "income" ? "+" : "−";
              return (
                <Row
                  key={r.id}
                  icon={meta.icon}
                  iconColor={meta.color}
                  title={r.name}
                  sub={sub}
                  value={`${sign}${fmtTRY(r.amount).replace("-", "")}`}
                  valueTone={
                    r.active
                      ? r.type === "income"
                        ? "pos"
                        : "default"
                      : "muted"
                  }
                  onPress={() => {
                    setEditingId(r.id);
                    setEditing(true);
                    setType(r.type);
                    setName(r.name);
                    setCategory(r.category);
                    setAmount(inputAmount(r.amount));
                    setPeriod(r.period);
                    setStartDate(r.startDate);
                    setActive(r.active);
                  }}
                  rightSlot={
                    <Switch
                      value={r.active}
                      onValueChange={() => toggle(r.id)}
                    />
                  }
                  swipeActions={[
                    {
                      label: "Sil",
                      tone: "danger",
                      onPress: () => remove(r.id),
                    },
                    {
                      label: "Atla",
                      tone: "warning",
                      onPress: () => skipNext(r.id),
                    },
                    {
                      label: "Öde",
                      tone: "primary",
                      onPress: () => payNow(r.id),
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
            title="Yeni abonelik"
            chevron
            onPress={() => {
              resetForm();
              setEditing(true);
            }}
            isFirst={recurring.length === 0}
          />
        </Grouped>
      </Sheet>
    );
  },
);
