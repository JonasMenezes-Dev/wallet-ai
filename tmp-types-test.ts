/* Arquivo temporário para validar a inferência do helper de tema. */
import { StyleSheet } from "react-native";

type Colors = { text: string };

//a fábrica devolve o objeto já criado pelo StyleSheet, e o tipo é
// derivado do próprio retorno.
function createThemedStylesF(
  factory: (colors: Colors) => StyleSheet.NamedStyles<any>,
) {
  return factory;
}

const stylesA = createThemedStylesF((colors) => ({
  container: {
    flex: 1,
    alignItems: "center",
    color: colors.text,
  },
}));

type A = typeof stylesA extends (c: Colors) => infer R ? R : never;
declare const a: A;
// Deve existir:
a.container;

// Abordagem 2: sem wrapper, só o tipo de retorno do StyleSheet.
const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      color: colors.text,
    },
  });

type B = ReturnType<typeof makeStyles>;
declare const b: B;
b.container;

export { };

