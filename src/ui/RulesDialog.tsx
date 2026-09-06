import { Dialog } from './Dialog.tsx';

const RULES = [
  {
    title: '每個彩色區域一隻柯基',
    body: '每一塊顏色都是獨立範圍，裡面剛好要有一隻柯基。空著、或同一塊放兩隻，都不成立。',
  },
  {
    title: '每一橫列、每一直欄各一隻',
    body: '放下一隻柯基後，同列與同欄的其他格子就可以直接排除。逐列逐欄掃過去，很快就能縮小候選範圍。',
  },
  {
    title: '柯基不能在周圍八格內相鄰',
    body: '兩隻柯基不可以上下、左右或斜角接觸。即使只在角落碰到，也不符合規則。',
  },
  {
    title: '用排除法，不要靠猜',
    body: '每一關都保證只有唯一解。依序檢查區域、橫列、直欄與周圍八格，用叉號標掉不可能的位置。',
  },
];

export function RulesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} title="遊戲規則" onClose={onClose}>
      <ol className="rules">
        {RULES.map((rule, index) => (
          <li key={rule.title}>
            <span className="rules-number">{index + 1}</span>
            <div>
              <h3>{rule.title}</h3>
              <p>{rule.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="rules-foot">
        點擊格子會依序切換：<b>空白 → 叉號 → 柯基 → 空白</b>。叉號只是你的筆記，不影響判定。
      </p>
    </Dialog>
  );
}
