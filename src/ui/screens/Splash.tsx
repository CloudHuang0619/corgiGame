/**
 * 載入頁
 *
 * 每次啟動隨機顯示一則語錄。原版的做法，成本很低但讓開場不那麼空。
 */

import { useEffect, useMemo } from 'react';

import { Corgi } from '../Corgi.tsx';
import type { Translate } from '../../i18n/index.ts';
import { randomQuote } from '../theme.ts';

interface SplashProps {
  readonly t: Translate;
  readonly onDone: () => void;
}

export function Splash({ t, onDone }: SplashProps) {
  const quote = useMemo(() => randomQuote(), []);

  useEffect(() => {
    const id = window.setTimeout(onDone, 1800);
    return () => window.clearTimeout(id);
  }, [onDone]);

  return (
    <div className="splash" onClick={onDone}>
      <Corgi className="splash-corgi" />
      <h1 className="splash-title">Corgidoku</h1>
      <p className="splash-tagline">{t('splash.tagline')}</p>

      <blockquote className="splash-quote">
        <p>「{quote.text}」</p>
        <cite>— {quote.author}</cite>
      </blockquote>
    </div>
  );
}
