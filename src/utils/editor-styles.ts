import React from 'react';

/**
 * @function getFormatStyles
 * @description يحصل على الـ CSS styles المناسبة لكل نوع من أنواع التنسيق في السيناريو
 * @param formatType - نوع التنسيق (action, character, dialogue, etc.)
 * @param selectedSize - حجم الخط المحدد
 * @returns React.CSSProperties - الـ styles المناسبة
 */
export const getFormatStyles = (
  formatType: string,
  selectedSize: string = '12pt',
  selectedFont: string = 'AzarMehrMonospaced-San',
): React.CSSProperties => {
  const baseStyles: React.CSSProperties = {
    fontFamily: selectedFont,
    fontSize: selectedSize,
    direction: 'rtl',
    lineHeight: '14pt',
    marginBottom: '2pt',
    minHeight: '14pt',
    fontWeight: 'bold',
  };

  const formatStyles: { [key: string]: React.CSSProperties } = {
    basmala: {
      textAlign: 'left',
      direction: 'ltr',
      width: '100%',
      fontWeight: 'bold',
      margin: '12px 0 24px 0',
    },
    'scene-header-top-line': {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      width: '100%',
      fontWeight: 'normal',
    },
    'scene-header-1': {
      fontWeight: 'normal',
      textTransform: 'uppercase',
    },
    'scene-header-2': {
      flex: '0 0 auto',
      fontWeight: 'normal',
    },
    'scene-header-3': {
      textAlign: 'center',
      fontWeight: 'normal',
    },
    action: {
      textAlign: 'justify',
      textAlignLast: 'right',
      textJustify: 'inter-word',
      width: '100%',
      margin: '0',
    },
    character: {
      textAlign: 'center',
      margin: '0 auto',
    },
    parenthetical: {
      textAlign: 'center',
      margin: '0 auto',
    },
    dialogue: {
      width: '4.1in',
      textAlign: 'center',
      margin: '0 auto',
      fontWeight: 'bold',
      paddingLeft: '1.5em',
      paddingRight: '1.5em',
     },
    transition: {
      textAlign: 'center',
      margin: '0 auto',
    },
  };

  const finalStyles = { ...baseStyles, ...formatStyles[formatType] };
  return finalStyles;
};
