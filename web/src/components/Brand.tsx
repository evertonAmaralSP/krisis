import logo from '../assets/krisis-logo-128.png';
import styles from './Brand.module.css';

/** Logo oficial (PNG, sem redesenho) + nome em Manrope, como na landing page. */
export function Brand({ size = 32, showName = true }: { size?: number; showName?: boolean }) {
  return (
    <span className={styles.brand}>
      <img src={logo} alt={showName ? '' : 'KRISIS'} width={size} height={size} className={styles.logo} />
      {showName && <span className={styles.name}>KRISIS</span>}
    </span>
  );
}
