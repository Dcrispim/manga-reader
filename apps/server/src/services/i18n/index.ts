import i18n from 'i18next'
import { messeges } from './languages/messeges'
import LanguageDetector from 'i18next-browser-languagedetector'
import React from 'react'

i18n.use(LanguageDetector).init({
  debug: false,
  resources: messeges,
  defaultNS: 'translation',
  fallbackLng: 'pt',
  ns: ['translation'],
})

// eslint-disable-next-line import/no-anonymous-default-export
export default (text: string | React.JSX.Element) =>
  typeof text === 'string' ? i18n.t(text) : text
