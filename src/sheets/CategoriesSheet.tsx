import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Alert } from "react-native";
import { Sheet, SheetRef } from "../ui/Sheet";
import { Grouped } from "../ui/Grouped";
import { Row, RowEmpty } from "../ui/Row";
import { Segmented } from "../ui/Controls";
import { Store, useStore } from "../store/store";
import { TxType } from "../store/types";
import { categoryMeta } from "../lib/constants";

export interface CategoriesSheetRef {
  open: () => void;
}

export const CategoriesSheet = forwardRef<CategoriesSheetRef>(
  function CategoriesSheet(_, ref) {
    const sheet = useRef<SheetRef>(null);
    const categories = useStore((s) => s.categories);
    const transactions = useStore((s) => s.transactions);
    const [type, setType] = useState<TxType>("expense");

    useImperativeHandle(
      ref,
      () => ({
        open() {
          sheet.current?.open();
        },
      }),
      [],
    );

    const list = categories[type];

    function add() {
      Alert.prompt?.("Yeni kategori", undefined, (name) => {
        const t = (name || "").trim();
        if (!t) return;
        if (categories[type].includes(t)) {
          Alert.alert("Zaten var", `"${t}" listede.`);
          return;
        }
        Store.update((s) => s.categories[type].push(t));
      });
    }

    function rename(oldName: string) {
      Alert.prompt?.("Yeniden adlandır", oldName, (next) => {
        const trimmed = (next || "").trim();
        if (!trimmed || trimmed === oldName) return;
        if (categories[type].includes(trimmed)) {
          Alert.alert("Zaten var", `"${trimmed}" listede.`);
          return;
        }
        Store.update((s) => {
          const idx = s.categories[type].indexOf(oldName);
          if (idx >= 0) s.categories[type][idx] = trimmed;
          // Update existing transactions' category names.
          for (const tx of s.transactions) {
            if (tx.type === type && tx.category === oldName)
              tx.category = trimmed;
          }
          for (const r of s.recurring) {
            if (r.type === type && r.category === oldName) r.category = trimmed;
          }
          for (const tpl of s.templates) {
            if (tpl.type === type && tpl.category === oldName)
              tpl.category = trimmed;
          }
        });
      });
    }

    function remove(name: string) {
      const usedCount = transactions.filter(
        (tx) => tx.type === type && tx.category === name,
      ).length;
      const msg =
        usedCount > 0
          ? `${usedCount} hareket bu kategoriyi kullanıyor. Silmek için önce başka kategoriye taşı.`
          : "Bu kategoriyi silmek istediğine emin misin?";
      Alert.alert("Sil", msg, [
        { text: "Vazgeç", style: "cancel" },
        ...(usedCount === 0
          ? [
              {
                text: "Sil",
                style: "destructive" as const,
                onPress: () => {
                  Store.update((s) => {
                    s.categories[type] = s.categories[type].filter(
                      (c) => c !== name,
                    );
                  });
                },
              },
            ]
          : []),
      ]);
    }

    return (
      <Sheet ref={sheet} title="Kategoriler" cancelLabel="Kapat">
        <Segmented<TxType>
          value={type}
          onChange={setType}
          options={[
            { key: "expense", label: "Gider" },
            { key: "income", label: "Gelir" },
          ]}
        />

        <Grouped
          header={
            type === "expense" ? "Gider Kategorileri" : "Gelir Kategorileri"
          }
          footer="Uzun bas: yeniden adlandır · Sağa kaydır: sil"
        >
          {list.length === 0 ? (
            <RowEmpty>Boş.</RowEmpty>
          ) : (
            list.map((name, i) => {
              const meta = categoryMeta(name);
              const used = transactions.filter(
                (tx) => tx.type === type && tx.category === name,
              ).length;
              return (
                <Row
                  key={name}
                  icon={meta.icon}
                  iconColor={meta.color}
                  title={name}
                  sub={used > 0 ? `${used} hareket` : "Kullanılmamış"}
                  onPress={() => rename(name)}
                  onLongPress={() => rename(name)}
                  swipeActions={[
                    {
                      label: "Sil",
                      tone: "danger",
                      onPress: () => remove(name),
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
            title="Yeni kategori"
            chevron
            onPress={add}
            isFirst={list.length === 0}
          />
        </Grouped>
      </Sheet>
    );
  },
);
