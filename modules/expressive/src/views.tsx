import { type PrimitiveBaseProps } from '@expo/ui/jetpack-compose';
import { createViewModifierEventListener } from '@expo/ui/jetpack-compose/modifiers';
import { requireNativeView } from 'expo';
import type { ColorValue } from 'react-native';

/** Marks children for a named slot of a custom Compose view (Expo UI's internal SlotView). */
const SlotNativeView = requireNativeView<{ slotName: string; children?: React.ReactNode }>(
  'ExpoUI',
  'SlotView',
);

export function Slot({ name, children }: { name: string; children?: React.ReactNode }) {
  return <SlotNativeView slotName={name}>{children}</SlotNativeView>;
}

function withModifierEvents<P extends PrimitiveBaseProps>(props: P) {
  const { modifiers } = props;
  return { ...props, ...(modifiers ? createViewModifierEventListener(modifiers) : undefined) };
}

/* -------------------------------------------------------------------------- */

const NativeExpressiveTheme = requireNativeView<PrimitiveBaseProps & { fontFamily?: string; children?: React.ReactNode }>(
  'Expressive',
  'ExpressiveThemeView',
);

/** Applies the brand type scale (Google Sans Flex) and expressive motion to its Compose subtree. */
export function ExpressiveTheme(props: PrimitiveBaseProps & { children?: React.ReactNode }) {
  return <NativeExpressiveTheme {...withModifierEvents(props)} />;
}

/* -------------------------------------------------------------------------- */

export type ButtonGroupOption = { key: string; label?: string; icon?: React.ReactNode };

export interface ConnectedButtonGroupProps extends PrimitiveBaseProps {
  options: ButtonGroupOption[];
  selected: string[];
  onSelectionChange: (keys: string[]) => void;
  multiSelect?: boolean;
  allowEmpty?: boolean;
  fillWidth?: boolean;
}

const NativeButtonGroup = requireNativeView<
  PrimitiveBaseProps & {
    options: { key: string; label: string }[];
    selectedKeys: string[];
    multiSelect?: boolean;
    allowEmpty?: boolean;
    fillWidth?: boolean;
    onSelectionChange: (e: { nativeEvent: { keys: string[] } }) => void;
    children?: React.ReactNode;
  }
>('Expressive', 'ConnectedButtonGroupView');

export function ConnectedButtonGroup({ options, selected, onSelectionChange, ...rest }: ConnectedButtonGroupProps) {
  return (
    <NativeButtonGroup
      {...withModifierEvents(rest)}
      options={options.map(({ key, label }) => ({ key, label: label ?? '' }))}
      selectedKeys={selected}
      onSelectionChange={(e) => onSelectionChange(e.nativeEvent.keys)}>
      {options.map((o) =>
        o.icon ? (
          <Slot key={o.key} name={`icon:${o.key}`}>
            {o.icon}
          </Slot>
        ) : null,
      )}
    </NativeButtonGroup>
  );
}

/* -------------------------------------------------------------------------- */

export type FabMenuItem = { key: string; label: string; icon: React.ReactNode };

export interface FabMenuProps extends PrimitiveBaseProps {
  icon: React.ReactNode;
  items: FabMenuItem[];
  onItemPress: (key: string) => void;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

const NativeFabMenu = requireNativeView<
  PrimitiveBaseProps & {
    items: { key: string; label: string }[];
    expanded?: boolean;
    onItemPress: (e: { nativeEvent: { key: string } }) => void;
    onExpandedChange: (e: { nativeEvent: { expanded: boolean } }) => void;
    children?: React.ReactNode;
  }
>('Expressive', 'FabMenuView');

export function FabMenu({ icon, items, onItemPress, onExpandedChange, ...rest }: FabMenuProps) {
  return (
    <NativeFabMenu
      {...withModifierEvents(rest)}
      items={items.map(({ key, label }) => ({ key, label }))}
      onItemPress={(e) => onItemPress(e.nativeEvent.key)}
      onExpandedChange={(e) => onExpandedChange?.(e.nativeEvent.expanded)}>
      <Slot name="fabIcon">{icon}</Slot>
      {items.map((item) => (
        <Slot key={item.key} name={`icon:${item.key}`}>
          {item.icon}
        </Slot>
      ))}
    </NativeFabMenu>
  );
}

/* -------------------------------------------------------------------------- */

export const MATERIAL_SHAPES = [
  'cookie4Sided', 'cookie6Sided', 'cookie7Sided', 'cookie9Sided', 'cookie12Sided',
  'clover4Leaf', 'clover8Leaf', 'softBurst', 'boom', 'oval', 'pill', 'triangle',
  'diamond', 'pentagon', 'sunny', 'verySunny', 'fan', 'pixelCircle', 'pixelTriangle',
  'ghostish', 'bun', 'heart', 'arch', 'slanted', 'puffy', 'puffyDiamond',
] as const;
export type MaterialShapeName = (typeof MATERIAL_SHAPES)[number];

export interface MorphingShapeProps extends PrimitiveBaseProps {
  shape: MaterialShapeName;
  morphTo?: MaterialShapeName;
  morphed?: boolean;
  rotation?: number;
  color?: ColorValue;
  children?: React.ReactNode;
}

const NativeMorphingShape = requireNativeView<MorphingShapeProps>('Expressive', 'MorphingShapeView');

export function MorphingShape(props: MorphingShapeProps) {
  return <NativeMorphingShape {...withModifierEvents(props)} />;
}
