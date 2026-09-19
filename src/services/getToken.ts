
import { normalizeStickyCode } from './fns'

export const STICKY_CODE_KEY = 'sticky_code'
export const MAX_STICKY_CODE_LENGTH = 8

/** Generates a compact sticky code from a city and number. */
export function generateCityToken(): string {
  const CITY_CODES: Record<string, string> = {
    TOKYO: 'JP',
    PARIS: 'FR',
    LONDON: 'UK',
    NEWYORK: 'US',
    BERLIN: 'DE',
    CAIRO: 'EG',
    ROME: 'IT',
    SYDNEY: 'AU',
    DUBAI: 'AE',
    NAIROBI: 'KE',
    RIO: 'BR',
    CAPETOWN: 'ZA',
    SEOUL: 'KR',
    MOSCOW: 'RU',
    MEXICO: 'MX',
    LAGOS: 'NG',
    BARCELONA: 'ES',
    BANGKOK: 'TH',
    TORONTO: 'CA',
    ISTANBUL: 'TR',
    ACCRA: 'GH',
    KAMPALA: 'UG',
    DODOMA: 'TZ',
    KIGALI: 'RW',
    ABIDJAN: 'CI',
    MANGO: 'GH',
    BANANA: 'UG',
    ORANGE: 'TZ',
    LEOPARD: 'RW',
    ELEPHANT: 'KE',
    LION: 'ZA',
    ZEBRA: 'NG',
    APPLE: 'US',
    AVOCADO: 'MX',
    PINEAPPLE: 'TH',
    PLUM: 'CA',
  }

  const [city, code] = Object.entries(CITY_CODES)[Math.floor(Math.random() * Object.keys(CITY_CODES).length)]
  const shortCity = city.slice(0, 4)
  const number = Math.floor(100 + Math.random() * 900)
  const token = `${shortCity}${code}${number}`
  const normalized = normalizeStickyCode(token)

  return normalized.padEnd(MAX_STICKY_CODE_LENGTH, 'X').slice(0, MAX_STICKY_CODE_LENGTH)
}

/** Gets the sticky code from the URL or local storage and persists it. */
export function getStickyCode(): string {
  if (typeof window === 'undefined') {
    return 'UNKNOWN'
  }

  const params = new URLSearchParams(window.location.search)
  const tokenFromQuery =
    params.get('stickyCode') ??
    params.get('sticky_code') ??
    localStorage.getItem(STICKY_CODE_KEY)

  const token = normalizeStickyCode(tokenFromQuery ?? '')

  if (tokenFromQuery && token) {
    localStorage.setItem(STICKY_CODE_KEY, token)
  }

  return token
}
