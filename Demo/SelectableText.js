import React from 'react'
import { Text, requireNativeComponent, Platform } from 'react-native'
import { v4 } from 'uuid'

const RNSelectableText = requireNativeComponent('RNSelectableText')

const BUILT_IN_STYLES = {
  BOLD: {
    fontWeight: 'bold',
  },
  ITALIC: {
    fontStyle: 'italic',
  },
  LINK: {
    textDecorationLine: 'underline',
  },
  UNDERLINE: {
    textDecorationLine: 'underline',
  },
  STRIKETHROUGH: {
    textDecorationLine: 'line-through',
  },
}

/**
 * text: string
 * highlights: array({start: int, end: int, id: any})
 * otherInlineStyleRanges: array({start: int, end: int, style: string})
 * 
 * returns
 * { text, highlightId, rangeStyle }
 */
const mapStyleRanges = (text, highlights, otherInlineStyleRanges = []) => {
  const parsedStyleRanges = [];

  const attrTriplets = [];
  highlights.forEach(({ start, end, id }) => {
    attrTriplets.push({ value: start, isEndValue: false, attrs: { attrId: id, highlightId: id } });
    attrTriplets.push({ value: end, isEndValue: true, attrs: { attrId: id, highlightId: id } });
  });
  otherInlineStyleRanges.forEach(({ start, end, style }, index) => {
    attrTriplets.push({ value: start, isEndValue: false, attrs: { attrId: `inline-style-${index}`, style: BUILT_IN_STYLES[style] } });
    attrTriplets.push({ value: end, isEndValue: true, attrs: { attrId: `inline-style-${index}`, style: BUILT_IN_STYLES[style] } });
  });

  attrTriplets.sort((a, b) => a.value - b.value);

  const currentAttrs = [];
  for (let i = 0; i < attrTriplets.length - 1; i++) {
    const firstTriplet = attrTriplets[i];
    const secondTriplet = attrTriplets[i + 1];

    if (!firstTriplet.isEndValue) currentAttrs.push(firstTriplet.attrs);
    else {
      const attrIndex = currentAttrs.findIndex(el => el.attrId === firstTriplet.attrs.attrId);
      if (attrIndex !== -1) currentAttrs.splice(attrIndex, 1);
    }

    const parsedAttrs = currentAttrs.map(({ highlightId, style }) => ({ highlightId, style }));
    parsedStyleRanges.push({ start: firstTriplet.value, end: secondTriplet.value, attrs: parsedAttrs });
  }

  const firstRangeStart = parsedStyleRanges[0].start;
  if (firstRangeStart !== 0) parsedStyleRanges.unshift({ start: 0, end: firstRangeStart, attrs: [] });

  const lastRangeEnd = parsedStyleRanges[parsedStyleRanges.length - 1].end;
  if (lastRangeEnd !== text.length) parsedStyleRanges.push({ start: lastRangeEnd, end: text.length, attrs: [] });

  const result = parsedStyleRanges.map(el => {
    const highlightIds = el.attrs.map(attr => attr.highlightId).filter(attr => Boolean(attr));
    const styles = el.attrs.map(attr => attr.style).filter(attr => Boolean(attr));
    return { text: text.slice(el.start, el.end), highlightIds, styles };
  });

  return result;
}

/**
 * Props
 * ...TextProps
 * onSelection: ({ content: string, eventType: string, selectionStart: int, selectionEnd: int }) => void
 * children: ReactNode
 * highlights: array({ id, start, end })
 * highlightColor: string
 * onHighlightPress: string => void
 * textValueProp: string
 * TextComponent: ReactNode
 * textComponentProps: object
 */
export const SelectableText = ({
  inlineStyles, highlightColor, onSelection, onNotHighlightPress, onHighlightPress, textValueProp, value, TextComponent,
  textComponentProps, ...props
}) => {
  const usesTextComponent = !TextComponent;
  TextComponent = TextComponent || Text;
  textValueProp = textValueProp || 'children';  // default to `children` which will render `value` as a child of `TextComponent`
  const onSelectionNative = ({
    nativeEvent: { content, eventType, selectionStart, selectionEnd },
  }) => {
    onSelection && onSelection({ content, eventType, selectionStart, selectionEnd })
  }

  const onHighlightPressNative = onHighlightPress
    ? Platform.OS === 'ios'
      ? ({ nativeEvent: { clickedRangeStart, clickedRangeEnd } }) => {
        if (!props.highlights || props.highlights.length === 0) {
          onNotHighlightPress && onNotHighlightPress();
          return;
        }

        const hightlightInRange = props.highlights.find(
          ({ start, end }) => clickedRangeStart >= start - 1 && clickedRangeEnd <= end + 1,
        )

        if (hightlightInRange) onHighlightPress(hightlightInRange.id)
        else onNotHighlightPress && onNotHighlightPress();
      }
      : onHighlightPress
    : () => { }

  // highlights feature is only supported if `TextComponent == Text`
  let textValue = value;
  if (usesTextComponent) {
    textValue = (
      props.highlights && props.highlights.length > 0
        ? mapStyleRanges(value, props.highlights, inlineStyles).map(({ text, highlightIds, styles }) => (
          <Text
            key={v4()}
            selectable
            style={[...styles, highlightIds?.[0] ? { backgroundColor: highlightColor } : {}]}
            onPress={() => {
              if (highlightIds?.[0]) onHighlightPress && onHighlightPress(highlightIds?.[0])
              else onNotHighlightPress && onNotHighlightPress();
            }}
            onLongPress={() => null}
          >
            {text}
          </Text>
        ))
        : [<Text key={v4()} selectable onPress={onNotHighlightPress} onLongPress={() => null}>{value}</Text>]
    );
    if (props.appendToChildren) {
      textValue.push(props.appendToChildren);
    }
  }
  return (
    <RNSelectableText
      {...props}
      onHighlightPress={onHighlightPressNative}
      selectable
      onSelection={onSelectionNative}
    >
      <TextComponent
        key={v4()}
        {...{ [textValueProp]: textValue, ...textComponentProps }}
      />
    </RNSelectableText>
  )
}
