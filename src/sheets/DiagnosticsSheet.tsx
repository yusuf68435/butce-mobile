import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { Sheet, SheetRef } from "../ui/Sheet";
import { Grouped } from "../ui/Grouped";
import { Row, RowEmpty } from "../ui/Row";
import { DestructiveButton } from "../ui/Controls";
import { ErrorEntry, clearErrors, readErrors } from "../lib/errorLog";
import { useTheme } from "../theme/tokens";

export interface DiagnosticsSheetRef {
  open: () => void;
}

function fmtAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export const DiagnosticsSheet = forwardRef<DiagnosticsSheetRef>(
  function DiagnosticsSheet(_, ref) {
    const sheet = useRef<SheetRef>(null);
    const t = useTheme();
    const [items, setItems] = useState<ErrorEntry[]>([]);
    const [expanded, setExpanded] = useState<string | null>(null);

    async function refresh() {
      const r = await readErrors();
      setItems(r);
    }

    useImperativeHandle(
      ref,
      () => ({
        open() {
          setItems([]);
          setExpanded(null);
          refresh();
          sheet.current?.open();
        },
      }),
      [],
    );

    function clear() {
      Alert.alert("Hata kaydı silinsin mi?", undefined, [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            await clearErrors();
            await refresh();
          },
        },
      ]);
    }

    return (
      <Sheet ref={sheet} title="Tanılama" cancelLabel="Kapat">
        <Grouped
          header="Son Hatalar"
          footer={
            items.length === 0
              ? "Bütçe sağlam."
              : "Sadece bu cihazda saklanır. Sunucuya gönderilmez."
          }
        >
          {items.length === 0 ? (
            <RowEmpty>Kayıtlı hata yok.</RowEmpty>
          ) : (
            items.map((e, i) => (
              <Row
                key={`${e.at}-${i}`}
                icon="bell"
                iconColor="red"
                title={e.message.slice(0, 64) || "Hata"}
                sub={`${e.source} · ${fmtAt(e.at)}`}
                onPress={() =>
                  setExpanded(
                    expanded === `${e.at}-${i}` ? null : `${e.at}-${i}`,
                  )
                }
                isFirst={i === 0}
              />
            ))
          )}
        </Grouped>

        {expanded && (
          <Grouped header="Stack Trace">
            <View style={[styles.stackBox, { backgroundColor: t.bg.elev }]}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ maxHeight: 240 }}
              >
                <Text
                  style={[styles.stackText, { color: t.label.secondary }]}
                  selectable
                >
                  {items.find((_, i) => `${items[i].at}-${i}` === expanded)
                    ?.stack || "Stack yok."}
                </Text>
              </ScrollView>
            </View>
          </Grouped>
        )}

        {items.length > 0 && (
          <DestructiveButton label="Hata Kaydını Sil" onPress={clear} />
        )}
      </Sheet>
    );
  },
);

const styles = StyleSheet.create({
  stackBox: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  stackText: {
    fontFamily: "Menlo",
    fontSize: 11,
    lineHeight: 16,
  },
});
