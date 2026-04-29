import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (!cancelled) setReduce(v);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) =>
      setReduce(v),
    );
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
  return reduce;
}

export function useReduceTransparency(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const probe = (
      AccessibilityInfo as unknown as {
        isReduceTransparencyEnabled?: () => Promise<boolean>;
      }
    ).isReduceTransparencyEnabled;
    if (probe) {
      probe().then((v) => {
        if (!cancelled) setReduce(v);
      });
    }
    const adder = (
      AccessibilityInfo as unknown as {
        addEventListener: (
          name: string,
          fn: (v: boolean) => void,
        ) => { remove: () => void };
      }
    ).addEventListener;
    const sub = adder("reduceTransparencyChanged", (v: boolean) =>
      setReduce(v),
    );
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
  return reduce;
}

export function useBoldText(): boolean {
  const [bold, setBold] = useState(false);
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isBoldTextEnabled().then((v) => {
      if (!cancelled) setBold(v);
    });
    const sub = AccessibilityInfo.addEventListener("boldTextChanged", (v) =>
      setBold(v),
    );
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
  return bold;
}
