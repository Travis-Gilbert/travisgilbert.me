'use client';

import { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { fetchGraphWeather } from '@/lib/ask-theseus';
import type { GraphWeatherData } from '@/lib/ask-theseus';
import styles from './GraphWeatherHeader.module.css';

const SPRING_GENTLE = { stiffness: 200, damping: 20 };

export default function GraphWeatherHeader() {
  const reduced = useReducedMotion();
  const [weather, setWeather] = useState<GraphWeatherData | null>(null);

  useEffect(() => {
    fetchGraphWeather()
      .then(setWeather)
      .catch(() => { /* fallback renders below */ });
  }, []);

  const headline = weather?.headline ?? 'Welcome to your graph';
  const detail = weather?.detail ?? 'Ask a question to explore what you know.';
  const iq = weather?.composite_iq ?? 0;
  const objects = weather?.total_objects ?? 0;
  const edges = weather?.total_edges ?? 0;

  return (
    <motion.div
      className={styles.weather}
      initial={reduced ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { type: 'spring', ...SPRING_GENTLE }}
    >
      <div className={styles.weatherMain}>
        <div className={styles.weatherTitle}>{headline}</div>
        <div className={styles.weatherSub}>{detail}</div>
      </div>
      {weather && (
        <div className={styles.weatherStats}>
          {iq > 0 && (
            <div className={styles.ws}>
              <span className={`${styles.wsVal} ${styles.iq}`}>{iq.toFixed(1)}</span>
              <span className={styles.wsLabel}>IQ</span>
            </div>
          )}
          <div className={styles.ws}>
            <span className={`${styles.wsVal} ${styles.obj}`}>{objects.toLocaleString()}</span>
            <span className={styles.wsLabel}>Objects</span>
          </div>
          <div className={styles.ws}>
            <span className={`${styles.wsVal} ${styles.edge}`}>{edges.toLocaleString()}</span>
            <span className={styles.wsLabel}>Edges</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}
