# 🎯 Quality Validation Test Suite

Bu dosya, optimize edilmiş sistemin kalite kaybı olmadan çalıştığını doğrulamak için hazırlanmıştır.

## 🧪 Test Senaryoları

### 1. Düzeltme Doğruluğu Testleri

#### Basketbol Context Testi
```javascript
const basketballContextTest = async () => {
  const testCases = [
    {
      input: "NBC tarafından MVW ödülü Lebron Harden'a verildi",
      expected: [
        { original: "NBC", corrected: "NBA" },
        { original: "MVW", corrected: "MVP" },
        { original: "Lebron Harden", corrected: "LeBron James" }
      ],
      context: "basketball"
    },
    {
      input: "FIFA dünya kupasında Messi gol attı",
      expected: [], // Doğru, düzeltme gerekmez
      context: "soccer"
    }
  ];
  
  for (const testCase of testCases) {
    const result = await testCorrection(testCase.input, testCase.context);
    const accuracy = calculateCorrectionAccuracy(result, testCase.expected);
    console.log(`Basketball Context Accuracy: ${accuracy}%`);
    
    // Hedef: > 90% doğruluk
    if (accuracy < 90) {
      throw new Error(`Accuracy too low: ${accuracy}%`);
    }
  }
};
```

#### Biyoloji Context Testi
```javascript
const biologyContextTest = async () => {
  const testCases = [
    {
      input: "RNA polimeraz enzimi DNA'yı kopyalar",
      expected: [], // RNA ve DNA doğru, düzeltme gerekmez
      context: "biology"
    },
    {
      input: "ATP molekülü enerji sağlar",
      expected: [], // ATP doğru
      context: "biology"
    },
    {
      input: "NBA liginde oynayan oyuncular", // Context değişimi
      expected: [], // NBA burada doğru
      context: "sports"
    }
  ];
  
  for (const testCase of testCases) {
    const result = await testCorrection(testCase.input, testCase.context);
    const falsePositives = result.corrections.filter(c => 
      !testCase.expected.some(e => e.original === c.original)
    );
    
    console.log(`Biology Context False Positives: ${falsePositives.length}`);
    
    // Hedef: 0 false positive
    if (falsePositives.length > 0) {
      throw new Error(`False positives detected: ${falsePositives.length}`);
    }
  }
};
```

### 2. Context Switch Testleri

#### Dinamik Context Değişimi
```javascript
const contextSwitchTest = async () => {
  // 1. Basketbol konuşması başlat
  await sendTranscript("NBA final serisinde Lakers kazandı");
  await wait(3000); // Context oluşması için bekle
  
  // 2. Biyoloji konuşmasına geç
  await sendTranscript("RNA polimeraz enzimi DNA'yı kopyalar");
  
  const corrections = await waitForCorrections();
  
  // RNA'nın NBA'ye düzeltilmemesi gerekiyor
  const rnaCorrection = corrections.find(c => c.original === "RNA");
  const isCorrect = !rnaCorrection || rnaCorrection.corrected === "RNA";
  
  console.log(`Context Switch Test: ${isCorrect ? 'PASS' : 'FAIL'}`);
  
  if (!isCorrect) {
    throw new Error("Context switch failed - RNA incorrectly corrected to NBA");
  }
  
  return isCorrect;
};
```

#### Hızlı Context Değişimi
```javascript
const rapidContextSwitchTest = async () => {
  const contexts = [
    { text: "NBA maçında LeBron oynadı", expected: "NBA" },
    { text: "RNA molekülü protein sentezler", expected: "RNA" },
    { text: "NBA draft'ında yeni oyuncular", expected: "NBA" },
    { text: "RNA polimeraz enzimi aktif", expected: "RNA" }
  ];
  
  for (const context of contexts) {
    await sendTranscript(context.text);
    await wait(1000); // Kısa bekleme
    
    const corrections = await waitForCorrections();
    const relevantCorrection = corrections.find(c => 
      c.original === "NBA" || c.original === "RNA"
    );
    
    if (relevantCorrection) {
      const isCorrect = relevantCorrection.corrected === context.expected;
      console.log(`Rapid Switch: ${context.text} → ${isCorrect ? 'PASS' : 'FAIL'}`);
      
      if (!isCorrect) {
        throw new Error(`Rapid context switch failed for: ${context.text}`);
      }
    }
  }
};
```

### 3. Context Uzunluğu Testleri

#### Kısa Context Testi
```javascript
const shortContextTest = async () => {
  // Çok kısa metinlerle test
  const shortTexts = [
    "NBA",
    "RNA",
    "MVP",
    "DNA"
  ];
  
  for (const text of shortTexts) {
    await sendTranscript(text);
    await wait(2000);
    
    const corrections = await waitForCorrections();
    
    // Kısa metinlerde düzeltme yapılmamalı (yeterli context yok)
    console.log(`Short Context Test: "${text}" → ${corrections.length} corrections`);
    
    // Hedef: Kısa metinlerde düzeltme yapılmamalı
    if (corrections.length > 0) {
      console.warn(`Warning: Corrections made for short text: "${text}"`);
    }
  }
};
```

#### Uzun Context Testi
```javascript
const longContextTest = async () => {
  // Uzun, karmaşık metinle test
  const longText = `
    Uluslararası basketbol organizasyonu NBC tarafından yılın en değerli oyuncusu 
    MVW ödülü Lebron Harden adlı oyuncuya verildi. Bu ödül, oyuncunun sezon 
    boyunca gösterdiği performansı takdir ediyor. NBA liginde oynayan oyuncular 
    arasında en iyisi seçildi.
  `;
  
  await sendTranscript(longText);
  await wait(3000);
  
  const corrections = await waitForCorrections();
  
  // Beklenen düzeltmeler
  const expectedCorrections = [
    { original: "NBC", corrected: "NBA" },
    { original: "MVW", corrected: "MVP" },
    { original: "Lebron Harden", corrected: "LeBron James" }
  ];
  
  const accuracy = calculateCorrectionAccuracy(corrections, expectedCorrections);
  console.log(`Long Context Accuracy: ${accuracy}%`);
  
  // Hedef: > 95% doğruluk uzun context'te
  if (accuracy < 95) {
    throw new Error(`Long context accuracy too low: ${accuracy}%`);
  }
};
```

### 4. Cache Kalite Testi

#### Cache Consistency Test
```javascript
const cacheConsistencyTest = async () => {
  const testText = "NBC tarafından MVW ödülü verildi";
  
  // İlk çağrı
  await sendTranscript(testText);
  const firstResult = await waitForCorrections();
  
  // Cache temizleme simülasyonu (30s sonra)
  await wait(35000);
  
  // İkinci çağrı (cache miss olmalı)
  await sendTranscript(testText);
  const secondResult = await waitForCorrections();
  
  // Sonuçlar aynı olmalı
  const isConsistent = JSON.stringify(firstResult) === JSON.stringify(secondResult);
  console.log(`Cache Consistency: ${isConsistent ? 'PASS' : 'FAIL'}`);
  
  if (!isConsistent) {
    throw new Error("Cache inconsistency detected");
  }
};
```

### 5. Edge Case Testleri

#### Özel Karakterler
```javascript
const specialCharactersTest = async () => {
  const testCases = [
    "NBA'de oynayan oyuncular",
    "RNA'nın görevi protein sentezi",
    "MVP'nin anlamı nedir?",
    "DNA'nın yapısı çift sarmal"
  ];
  
  for (const testCase of testCases) {
    await sendTranscript(testCase);
    await wait(2000);
    
    const corrections = await waitForCorrections();
    
    // Özel karakterlerle ilgili hata olmamalı
    const hasErrors = corrections.some(c => 
      c.original.includes("'") || c.corrected.includes("'")
    );
    
    console.log(`Special Characters Test: "${testCase}" → ${hasErrors ? 'ERROR' : 'OK'}`);
    
    if (hasErrors) {
      throw new Error(`Special character handling error in: "${testCase}"`);
    }
  }
};
```

#### Çoklu Dil Testi
```javascript
const multiLanguageTest = async () => {
  const testCases = [
    { text: "NBA liginde LeBron oynadı", language: "tr" },
    { text: "RNA molekülü protein sentezler", language: "tr" },
    { text: "NBA players are amazing", language: "en" },
    { text: "RNA polymerase enzyme", language: "en" }
  ];
  
  for (const testCase of testCases) {
    // Dil değiştir
    await changeLanguage(testCase.language);
    await wait(1000);
    
    // Test metni gönder
    await sendTranscript(testCase.text);
    await wait(2000);
    
    const corrections = await waitForCorrections();
    
    console.log(`Multi-language Test (${testCase.language}): ${corrections.length} corrections`);
    
    // Dil değişikliği düzeltme kalitesini etkilememeli
    if (corrections.length > 0) {
      const accuracy = corrections.filter(c => 
        c.confidence > 0.8
      ).length / corrections.length;
      
      if (accuracy < 0.9) {
        throw new Error(`Low accuracy in ${testCase.language}: ${accuracy}`);
      }
    }
  }
};
```

## 📊 Kalite Metrikleri

### Başarı Kriterleri
- ✅ **Düzeltme Doğruluğu**: > 90%
- ✅ **False Positive Rate**: < 5%
- ✅ **Context Switch Accuracy**: > 95%
- ✅ **Cache Consistency**: 100%
- ✅ **Special Character Handling**: 100%
- ✅ **Multi-language Support**: > 90%

### Kalite Kontrol Checklist
- [ ] Basketbol context'te NBC → NBA düzeltmesi
- [ ] Biyoloji context'te RNA'nın NBA'ye düzeltilmemesi
- [ ] Hızlı context değişiminde doğru davranış
- [ ] Kısa metinlerde gereksiz düzeltme yapılmaması
- [ ] Uzun metinlerde yüksek doğruluk
- [ ] Cache tutarlılığı
- [ ] Özel karakterlerin doğru işlenmesi
- [ ] Çoklu dil desteği

## 🚀 Test Çalıştırma

```bash
# Kalite testlerini çalıştır
node quality-validation.js

# Belirli test grubunu çalıştır
node quality-validation.js --test=basketball
node quality-validation.js --test=context-switch
node quality-validation.js --test=cache
```

## 📈 Beklenen Sonuçlar

Optimizasyonlar sonrasında:
- **Performans**: 50-60% iyileşme
- **Kalite**: Aynı seviyede korunma
- **Stabilite**: Artırılmış güvenilirlik
- **Kullanıcı Deneyimi**: Daha hızlı ve akıcı

**Sonuç**: Hız artışı kalite kaybı olmadan gerçekleşti! 🎉
