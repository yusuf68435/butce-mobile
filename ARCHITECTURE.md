# Bütçe — Mimari Notları

Bu doküman gelecekteki kendine ya da başka birine "bu kodda neden böyle?"
sorularına saatler değil dakikalar içinde cevap verebilmek için.

## Bir bakışta

```
┌──────────────────────────────────────────────────────────────────────┐
│  App.tsx                                                             │
│  ├─ ErrorBoundary (crash recovery)                                   │
│  ├─ Hydrate gate (loading → onboarding → lock → CashScreen)          │
│  └─ AppState lifecycle (background → re-lock if biometric)           │
└──────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────────────────┐
│  CashScreen.tsx — TEK ekran                                          │
│  ├─ Navbar (gear, chart, sparkles | calendar, search, plus)          │
│  ├─ Hero (bu ay bakiye + shimmer + MoM badge)                        │
│  ├─ PriceStrip (canlı altın/USD/EUR)                                 │
│  ├─ Pill (ay seçici)                                                 │
│  ├─ Weekly stat (son 7 gün +/-)                                      │
│  ├─ Toplam Servet (cash, varlıklar, bekleyen?, borç?)                │
│  ├─ Gider Dağılımı (donut chart)                                     │
│  ├─ Bütçe Limitleri (ring gauge)                                     │
│  ├─ Abonelikler (yaklaşan 7 gün önizleme)                            │
│  ├─ Hedefler                                                         │
│  ├─ Bekleyenler (varsa)                                              │
│  └─ Hareketler (cap 100, swipe + long-press menu)                    │
└──────────────────────────────────────────────────────────────────────┘
            │
            ▼ (sheet'ler ekran üzerine açılır)
┌──────────────────────────────────────────────────────────────────────┐
│  18 Sheet                                                            │
│  Tx, Search, Calc, Calendar, Insights, Trends, Goals, Recurring,    │
│  BudgetLimit, Assets, Debts, Pending, Collect, Templates,           │
│  Categories, AutoBackups, Diagnostics, Settings, MonthPicker         │
└──────────────────────────────────────────────────────────────────────┘
```

## Veri katmanı

### Tek state, tek kaynak

```typescript
AppState = {
  transactions, pending, recurring, goals,
  assets, debts, templates,
  categories: { income[], expense[] },
  settings: { ... }
}
```

Tüm veri **AsyncStorage**'da tek anahtar altında: `ggai:state:v1`. Format
versiyon-aware: `__v: number` ile birlikte yazılır, hydrate'te migration
chain (`migrations.ts`) çalışır.

### Mutate-in-place + version counter

```typescript
Store.update((s) => {
  s.transactions.push(newTx); // mutate in place
});
```

Bu pattern Redux'un saflığına aykırı görünür ama React 18'in
`useSyncExternalStore` ile **version counter** kullanılınca çalışır:

```typescript
// store.ts
let version = 0;
function emit() {
  version += 1;
  listeners.forEach((fn) => fn());
}

useStore = (selector) => {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => version,
  );
  return selector(state); // state OK to mutate; version forces re-render
};
```

Avantaj: kullanıcı kodu basit. Trade-off: time-travel debugging yok (önemsiz).

### Migration chain

`src/store/migrations.ts` — append-only fonksiyon listesi:

```
unversioned → v1 → v2 → v3 → v4 (current)
```

- v1: temel şema garanti
- v2: `assets`, `debts`, `wallets` array'leri + default settings
- v3: `templates` array'i
- v4: silver→asset taşı, wallets/themeOverride/defaultTab/stocks **sil**

**Kural:** Yayınlanmış migration'a dokunma. Yeni bir bug var ise yeni
migration ekle.

`STATE_VERSION` (constants) ve `CURRENT_VERSION` (migrations) **aynı**
sayı olmalı.

### Hydrate akışı

```
1. AsyncStorage.getItem(KEY) → raw string
2. JSON.parse → object
3. migrate(obj) → güncel sürüm
4. normalize → AppState
5. chargeDueRecurring (geçmiş abonelik tx'leri yarat)
6. emit
7. setTimeout 1.5sn: maybeWriteAutoBackup
8. setTimeout 3sn: sweepOrphanPhotos
```

Adım 1-3 başarısız olursa `hydrationFailed = true`, **disk'teki bozuk veri
silinmez**. App.tsx flag'i izler, kullanıcıya alert gösterir.

### Persist akışı

Her `Store.update()` ile:

1. mutator çalıştır
2. `AsyncStorage.setItem(KEY, JSON.stringify({ ...state, __v }))` (await yok)
3. emit (version bump → tüm subscriber re-render)

Persist failure → `errorLog`'a yazılır, kullanıcı Diagnostics'te görür.

## UI katmanı

### Sheet pattern

```typescript
// FooSheet.tsx
export interface FooSheetRef { open: (id?: string) => void; }
export const FooSheet = forwardRef<FooSheetRef>((_, ref) => {
  const sheet = useRef<SheetRef>(null);
  useImperativeHandle(ref, () => ({ open: (id) => { ...; sheet.current?.open(); } }));
  return <Sheet ref={sheet} title="Foo" actionLabel="Kaydet" onAction={save}>...</Sheet>;
});

// CashScreen.tsx
const fooSheet = useRef<FooSheetRef>(null);
// in JSX: <FooSheet ref={fooSheet} />
// trigger: <Pressable onPress={() => fooSheet.current?.open()} />
```

Avantaj: imperative API (kontrol açan yerde), state sheet içinde, parent
re-render etmez sheet açılınca.

### Sheet → Sheet zinciri

iOS'ta sheet üstünde sheet doğal değil. Mevcut pattern: `close + setTimeout
250ms + open()`. Brittle ama çalışıyor.

### Multi-detent

`Sheet` props: `largeOnly?` ile single ya da dual detent (`["55%", "92%"]`).

### Row primitive

`ui/Row.tsx` her listenin temeli. Props:

- `icon + iconColor` — 30x30 yuvarlak köşe icon
- `title + sub`
- `value` veya `valueStack` (üst+alt)
- `chevron`, `rightSlot` (Switch vs.)
- `swipeActions` — sağdan kaydırma menüsü
- `onPress`, `onLongPress`
- `thumbUri` — receipt 28x28

Apple HIG kompakt liste satırı.

## Servisler ve dış bağımlılıklar

### prices.ts

3 kaynak fallback chain:

1. **truncgil** (TR finans, JSON, gold + USD + EUR + silver)
2. **TCMB** (resmi XML, sadece USD + EUR, gold yok)
3. **open.er-api.com** (USD-base, sadece USD/EUR)

15 dk in-memory cache + AsyncStorage persist. `fetchPrices(force)` ile
manuel refresh.

### crypto.ts

AES-256-CBC + PBKDF2 (200k iter). Sadece **manuel paylaşılan yedek** dosyası
şifreli. AsyncStorage içeriği şifreli değil — iOS Data Protection
Class C zaten kullanıcı oturumu açıkken erişilebilir, app sandbox'ta
kalır.

### biometric.ts

`expo-local-authentication` defansif wrapper. App'in lock state'i:

- `settings.biometricLock` true ise açılışta locked
- Background'a gidip 60sn+ sonra geldiyse re-lock
- `authenticate()` Face ID/Touch ID prompt

### autoBackup.ts

Her 7 günde bir (bağlama Cihaz takvimi):

- `documentDirectory/auto-backups/backup-YYYY-MM-DD.json`
- Son 4 yedek tutulur, eskileri silinir
- Hydrate sonrası 1.5sn delay ile fire-and-forget

**iCloud Backup'a dahil** (kullanıcı iCloud Backup açtıysa).

### errorLog.ts

AsyncStorage ring buffer (25 entry). `logError(source, err)` çağırılır:

- ErrorBoundary catch
- Store persist/hydrate failure
- User initiated (gelecekte)

Diagnostics sheet'ten görülür (5x tap easter egg).

### photos.ts

- `persistPhoto(srcUri)` → expo-image-manipulator ile EXIF strip + 1600px
  resize + JPEG q=0.7 → `documentDirectory/receipts/{ts}_{rand}.jpg`
- `deletePhoto(uri)` idempotent
- `sweepOrphanPhotos(keepUris)` — Store.replace, Store.reset, hydrate
  sonrası tetiklenir. Tx'lerde olmayan dosyalar silinir.

## Test stratejisi

### 14 suite, 148 test

| Modül       | Test sayısı                                                                            |
| ----------- | -------------------------------------------------------------------------------------- |
| selectors   | 30 (txOfMonth, monthlyTotals, chargeDueRecurring, debts, tags, merchants, weekly, ...) |
| migrations  | 8 (v1→v4 chain + edge case)                                                            |
| hydrate     | 5 (clean / valid / corrupt / legacy / no-overwrite)                                    |
| insights    | 9                                                                                      |
| format      | 30 (parse/fmt/normalize/shiftMonthKey/parseAmountQuery)                                |
| crypto      | 5                                                                                      |
| autoBackup  | 9 (shouldBackup + pruneTargets)                                                        |
| photos      | 5 (orphanFilenames)                                                                    |
| storage     | 4 (formatBytes)                                                                        |
| errorLog    | 6                                                                                      |
| csv         | 8                                                                                      |
| i18n        | 3                                                                                      |
| prices      | 15 (parseTRNumber + pickPrice + pickTcmbRate)                                          |
| alias-smoke | 2 (path aliases work)                                                                  |

### Test stub'ları (jest)

`test/` altında:

- `rn-stub.js` → react-native modülünü stub'la (Platform, AccessibilityInfo, vb.)
- `expo-fs-stub.js` → expo-file-system'i no-op stub
- `async-storage-stub.js` → in-memory Map

`jest.config.js` `moduleNameMapper` ile bunları yönlendirir + `@/*` aliası.

### Saf-fonksiyon önceliği

UI komponentleri test edilmez (manuel cihaz testi); business logic %100
saf fonksiyonlara çekilir ve test edilir. Örnek: `shouldBackup`,
`orphanFilenames`, `parseAmountQuery`, `parseTRNumber` — IO'dan ayrılmış.

## Sürüm akışı (yeni feature ekleme)

### Yeni state alanı

1. `types.ts` — interface'e ekle
2. `migrations.ts` — yeni `CURRENT_VERSION + 1` migration ekle, eski sürümlerden taşı
3. `STATE_VERSION` ve `CURRENT_VERSION`'u bumple
4. `store.ts` `fresh()` ve `normalize()`'da default değer ver
5. Test ekle

### Yeni sheet

1. `src/sheets/FooSheet.tsx` — Sheet pattern (yukarıda)
2. `CashScreen.tsx` — ref + mount
3. Trigger: navbar action / row / swipe

### Yeni selector

1. `src/store/selectors.ts` — saf fonksiyon, gerekirse `WithTransactions`
   gibi narrow type al
2. Test ekle (`__tests__/selectors.test.ts`)
3. Sheet/screen'de kullan

## Bilinçli kararlar

- **Tek tab IA** — tek kullanıcı, tek "Cash" zihinsel modeli
- **Mutate-in-place store** — basitlik > saflık
- **Migration tek-yön** — geri çevirmek karmaşıklık katar, yedek yeterli
- **Yahoo Finance kapalı** — kararsız source, BIST hisse 1.0'da yok
- **AES sadece manuel yedek için** — AsyncStorage zaten sandbox'ta + iOS Data Protection
- **Ses yok** — Apple Cash ses kullanmaz, tactile haptics yeter
- **Apple HIG renk tonları** — özel hex hiç yok, hep semantic colors
- **i18n iskelet TR-only** — ilk kullanıcı sadece kendisi, EN ileride

## Bilinen sınırlar

- **Native özellikler yok**: Widget, App Intents, Live Activities, Apple Watch
  → EAS Dev Client ile eklenebilir (`eas.json` hazır)
- **Çoklu cihaz canlı sync yok**: yalnız iCloud Backup ile cihaz
  değiştirme senaryosu
- **OCR yok**: fişler kaydedilir, metin çıkarılmaz
- **Çoklu kullanıcı yok**: tek state, tek bağlam
