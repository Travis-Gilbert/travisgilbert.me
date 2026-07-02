import { cn } from '@/lib/utils';
import styles from './chrome.module.css';

/**
 * Parametric chrome layer (SPEC-PARAMETRIC-DESIGN-SYSTEM D5).
 * The patent-drawing identity as components whose geometry is computed from
 * the seed tokens (--space-unit, --hairline-w, semantic accents). Changing
 * the seed's hairline or unit re-tunes every mark; nothing here carries a
 * hand-picked value. The weave-spinner (the one animated chrome piece) lives
 * in components/commonplace/views/WeaveSpinner and consumes the same tokens.
 */

export function HairlineRule({
  ticked = false,
  accent = false,
  className,
}: {
  ticked?: boolean;
  accent?: boolean;
  className?: string;
}) {
  return (
    <hr
      className={cn(
        styles.rule,
        ticked && styles.ruleTicked,
        accent && styles.ruleAccent,
        className,
      )}
      aria-hidden="true"
    />
  );
}

export function RegistrationMark({
  accent = false,
  className,
}: {
  accent?: boolean;
  className?: string;
}) {
  return (
    <span className={cn(styles.reg, accent && styles.regAccent, className)} aria-hidden="true">
      <span className={styles.regRing} />
    </span>
  );
}

export function DimensionTicks({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div className={cn(styles.dim, className)} role="presentation">
      <span className={cn(styles.dimLine, styles.dimStart)} />
      <span>{label}</span>
      <span className={cn(styles.dimLine, styles.dimEnd)} />
    </div>
  );
}

export { WeaveSpinner } from '../commonplace/views/WeaveSpinner';
