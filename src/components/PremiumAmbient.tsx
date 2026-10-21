import { Image } from "expo-image";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { ambientOpacity, useThemeColors } from "../theme";

type PremiumAmbientProps = {
  variant?: keyof typeof ambientOpacity;
  placement?: "screen" | "card";
};
const topography = require("../../assets/premium/topography.svg");
const arcs = require("../../assets/premium/arcs.svg");

/** SVGs aprovados do Figma, locais e estáticos, recortados atrás do conteúdo. */
export function PremiumAmbient({ variant = "standard", placement = "screen" }: PremiumAmbientProps) {
  const colors = useThemeColors();
  const [width, setWidth] = useState(390);
  const scale = width / 390;
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={event => { const next = event.nativeEvent.layout.width; if (next > 0) setWidth(next); }}
      style={[StyleSheet.absoluteFill, styles.clip]}
    >
      <Image
        source={topography}
        accessible={false}
        contentFit="contain"
        tintColor={colors.primary}
        style={{ position: "absolute", width: 697.433 * scale, height: 949.705 * scale, left: -149 * scale, top: (placement === "card" ? -80 : -34.355) * scale, opacity: ambientOpacity[variant] }}
      />
      {variant === "highlight" ? (
        <Image
          source={arcs}
          accessible={false}
          contentFit="contain"
          tintColor={colors.primary}
          style={{ position: "absolute", width: 390 * scale, height: 320 * scale, right: 0, top: placement === "card" ? -60 * scale : 112 * scale }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ clip: { overflow: "hidden" } });
