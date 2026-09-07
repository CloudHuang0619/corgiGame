/** 繁體中文。這是基準語言，其他語系的鍵值以此為準。 */
export const zhHant = {
  // 載入頁
  'splash.tagline': '柯基邏輯益智',

  // 首頁
  'home.dailyChallenge': '每日挑戰',
  'home.dailyChallengeLocked': '通關第 {level} 關解鎖',
  'home.dailyChallengeToast': '每日挑戰在第 {level} 關後解鎖',
  'home.levelCta': '第 {level} 關',
  'home.bones': '骨頭',

  // 遊戲主畫面
  'game.level': '關卡',
  'game.score': '分數',
  'game.rule.region': '一種顏色一隻柯基',
  'game.rule.line': '每行每列各一隻柯基',
  'game.rule.adjacent': '柯基不能相鄰',
  'game.hintTitle': '{target} － 僅剩一格可放柯基',
  'game.hintApply': '套用',
  'game.hintNone': '目前推不出下一步，先檢查盤面。',
  'game.hintRow': '第 {n} 列',
  'game.hintCol': '第 {n} 欄',
  'game.hintRegion': '這個顏色區域',

  // 結算
  'clear.toast': '思路敏銳，幾近完美。',
  'clear.boneTally': '骨頭',
  'clear.flawless': '無懈可擊',
  'clear.flawlessSub': '完全乾淨的紀錄！你的邏輯真棒！',
  'clear.good': '順利過關',
  'clear.goodSub': '再穩一點就是完美了。',
  'clear.close': '驚險過關',
  'clear.closeSub': '最後一根骨頭撐住了。',
  'clear.next': '第 {level} 關',
  'clear.bonesEarned': '獲得 {n} 根骨頭',
  'clear.allDone': '目前的關卡都通關了，之後會再加。',

  // 失敗
  'fail.title': '骨頭用完了',
  'fail.body': '三次都放錯了，這一關要重來。',
  'fail.tip': '放柯基之前，先把同列、同欄、同色區與周圍八格都標上叉號。',
  'fail.retry': '再試一次',

  // 設定
  'settings.title': '設定',
  'settings.music': '音樂',
  'settings.sfx': '音效',
  'settings.voice': '人聲',
  'settings.vibration': '震動',
  'settings.on': 'ON',
  'settings.off': 'OFF',
  'settings.patternMode': '圖案模式',
  'settings.language': '語言',
  'settings.feedback': '意見回饋',
  'settings.restart': '重新開始',
  'settings.terms': '服務條款',
  'settings.privacy': '隱私權政策',
  'settings.version': '版本 {version}',
  'settings.toastOn': '{item}已開啟',
  'settings.toastOff': '{item}已關閉',

  // 個人資料
  'profile.title': '個人資料',
  'profile.avatar': '頭像',
  'profile.frame': '頭像框',
  'profile.confirm': '確認',

  // 語言
  'language.title': '語言',
  'language.confirm': '確定',

  // 測試工具（不屬於正式流程）
  'dev.title': '測試工具',
  'dev.slowMotion': '慢速 ×3',
  'dev.undo': '復原',
  'dev.reveal': '看答案',
  'dev.hideAnswer': '收起答案',
  'dev.levelPicker': '選關卡',
  'dev.timer': '計時',
  'dev.note': '正式版不會有這一區，僅供開發測試。',

  // 共用
  'common.back': '返回',
  'common.close': '關閉',
} as const;

export type MessageKey = keyof typeof zhHant;
