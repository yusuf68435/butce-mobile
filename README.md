# Bütçe — Mobile

Apple HIG hizalı, offline-first kişisel finans takibi. Tüm veri cihazda kalır.

## Çalıştırma

```bash
npm install
npm start          # Expo bundler
npm run ios        # iOS simulator
npm run android    # Android emulator
```

Cihazda test için Expo Go uygulamasından QR'ı tara.

## Komutlar

| Komut               | Ne yapar                     |
| ------------------- | ---------------------------- |
| `npm start`         | Expo dev server              |
| `npm test`          | Jest unit testleri (8 suite) |
| `npm run typecheck` | `tsc --noEmit`               |

## Mimari Özet

- **Veri**: tek `AppState` JSON, AsyncStorage'da `ggai:state:v1`. Migration framework v1→v2→v3 (`src/store/migrations.ts`).
- **Store**: `useSyncExternalStore` + version counter. Mutate-in-place mutator pattern (`Store.update(s => s.x = ...)`).
- **Selectors**: pure functions, kolay test edilir (`src/store/selectors.ts`).
- **Persist**: her `Store.update`'te AsyncStorage'a yazılır + sessiz haftalık otomatik yedek (`src/lib/autoBackup.ts`).
- **UI**: tek ekran (CashScreen) + 14 sheet. Sheet'ler `forwardRef + useImperativeHandle` ile imperative API açar.
- **Tema**: iOS semantic colors, light/dark/auto override (`src/theme/tokens.ts`).
- **i18n**: TR + EN parite (`src/lib/i18n.ts`), system locale detect.

## Klasör Yapısı

```
src/
├─ screens/          CashScreen, PendingScreen, SilverScreen, OnboardingScreen
├─ sheets/           14 sheet (Tx, Search, Calc, Templates, Categories, …)
├─ ui/               Row, Hero, Sheet, Pill, Chip, Segmented, Icon, Text, …
├─ store/
│  ├─ store.ts       Store + useStore hook
│  ├─ types.ts       AppState + tüm interface'ler
│  ├─ selectors.ts   Pure selectors
│  ├─ migrations.ts  Migration chain
│  └─ __tests__/
├─ lib/
│  ├─ format.ts      fmtTRY, parseAmount, normalizeTags, …
│  ├─ prices.ts      truncgil + tcmb + er-api fallback chain + Yahoo BIST
│  ├─ crypto.ts      AES-256 yedek şifreleme (PBKDF2)
│  ├─ haptics.ts     expo-haptics defansif wrapper
│  ├─ biometric.ts   Face ID/Touch ID
│  ├─ photos.ts      Receipt foto persist
│  ├─ autoBackup.ts  Sessiz haftalık yedek
│  ├─ i18n.ts        TR/EN sözlük
│  ├─ insights.ts    AI özet, anomaly, cashflow forecast
│  ├─ sampleData.ts  Onboarding örnek veri
│  └─ notifications.ts
└─ theme/
   ├─ tokens.ts      Light/dark theme + override
   └─ a11y.ts        Reduce Motion / Bold Text hooks
```

## Önemli Tasarım Kararları

1. **Tek kullanıcı, cihazda kalır** — sunucu, hesap, telemetry yok.
2. **Yedek**: manuel paylaşım (şifreli/şifresiz) + sessiz haftalık otomatik (cihaz dahili).
3. **Mutation pattern**: `Store.update(s => s.x.push(...))`. Version counter re-render'ı garanti eder.
4. **Sheet > Modal**: tüm sub-akışlar `@gorhom/bottom-sheet` üstünde. Multi-detent (medium/large).
5. **Apple HIG**: SF Symbols (iOS), Dynamic Type, VoiceOver, Reduce Motion, Haptics — eksik kalan tek şey EAS Dev Client gerektirenler (Widget, App Intents, Live Activities).

## Test Stratejisi

Jest + ts-jest. 79 test pure logic'e odaklı:

- `selectors.ts` — addPeriod, monthlyTotals, chargeDueRecurring, tagSpending, debtsNet
- `migrations.ts` — v0→v1→v2→v3 chain
- `format.ts` — fmtTRY, parseAmount, normalizeTags
- `crypto.ts` — encrypt/decrypt round-trip
- `insights.ts` — anomaly detection, cashflow, suggestCategory
- `sampleData.ts` — sample state shape
- `autoBackup.ts` — shouldBackup decision, pruneTargets
- `i18n.ts` — TR/EN swap

UI komponentleri Expo cihaz testi ile doğrulanır.

## Bilinen Sınırlar

- **Widget / App Intents / Live Activities** — EAS Dev Client + native target gerektirir. Şu an yok.
- **Çoklu-cihaz canlı sync** — yok. iOS iCloud Backup zaten cihaz yedeğine
  dahildir (AsyncStorage + `documentDirectory`/receipts), ama "sync" değil:
  yeni cihaz ↔ eski cihaz arası anlık güncelleme yok.
- **OCR / fiş okuma** — fişler kaydedilir, metin çıkarımı yapılmaz.
- **BIST hisse** — Personal Edition'da kapalı (Yahoo Finance API kararsız).
  Eski sürümden gelen veri Migration v4'te `__droppedStocks`'a saklanır,
  silinmez.

### Yedek nereye gider?

| Veri                            | Konum                              | iCloud Backup'a dahil? |
| ------------------------------- | ---------------------------------- | ---------------------- |
| Transactions, settings, vs.     | AsyncStorage (`Library/RKStorage`) | ✅                     |
| Receipt fotoğrafları            | `documentDirectory/receipts/`      | ✅                     |
| Otomatik haftalık yedek         | `documentDirectory/auto-backups/`  | ✅                     |
| Manuel paylaşılan yedek (.json) | Cache → kullanıcı seçtiği yere     | Kullanıcıya bağlı      |

Kullanıcı **iCloud Backup açıksa**, telefon kaybolursa yeni iPhone'a setup
sırasında veriler otomatik geri gelir.

## Sürüm Akışı

State şeması değişikliği:

1. `src/store/types.ts`'e alan ekle.
2. `src/store/migrations.ts`'e yeni `CURRENT_VERSION + 1` migration ekle.
3. `CURRENT_VERSION` ve `STATE_VERSION`'u bump et.
4. Test ekle.

Yeni sheet:

1. `src/sheets/FooSheet.tsx` oluştur (`forwardRef + useImperativeHandle`).
2. `CashScreen.tsx`'te ref + mount ekle.
3. Açılış noktası (navbar / row / swipe action) bağla.

## CI

`.github/workflows/ci.yml` her push/PR'da typecheck + test koşar.

## EAS Dev Client / TestFlight

Expo Go (default `npm start` flow) bu app'in tüm özelliklerini destekler ama
**Widget, App Intents (Siri), Live Activities** gibi native iOS feature'ları
istersen EAS Dev Client'a geçmen gerekir.

### İlk kurulum (tek seferlik)

```bash
# 1. Hesap oluştur veya login
npm run eas:login

# 2. Projeyi EAS'a bağla (extra.eas.projectId üretir)
npm run eas:init

# 3. iOS Simulator için development build (dev-client + tüm feature'lar)
npm run eas:build:dev

# 4. Build bittiğinde QR ile cihaza kur, sonra:
npm start
# → Expo CLI dev-client build'ini bulur, oradan açabilirsin.
```

### app.json bundle ID

`com.yusufuyar.butce` — kendinin yapmak istersen değiştir, sonra
`eas:init` ile yeniden bağla. Apple Developer hesabın gerekir
($99/yıl) — sadece kişisel cihaza yüklemek için bile gereklidir.

### Sonraki sürümler

```bash
# Apple TestFlight için (App Store Connect'e yükler)
npm run eas:build:prod

# Build numarası app.json'da otomatik artar (eas.json autoIncrement)
```

### Test paylaşımı (TestFlight olmadan)

```bash
npm run eas:build:preview
# → Internal distribution APK / IPA, QR ile direkt cihaza
```

### Şu an EAS gerekmez

Yalnız aşağıdakiler için gerekir:

- iOS Widget / Lock Screen widget
- App Intents (Siri Shortcut)
- Live Activities (Dynamic Island)
- Apple Watch app
- Native module ekleme

Bu özelliklerin hiçbiri olmadan app **tam çalışır** ve Expo Go'da test
edilebilir.
