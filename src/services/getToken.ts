
export const STICKY_CODE_KEY = 'sticky_code'

/** Generates a readable sticky code from a city, country code, and number. */
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
    MEXICOCITY: 'MX',
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
    PINEAPPLE: 'TH',
    APPLE: 'US',
    AVOCADO: 'MX',
    PEAR: 'FR',
    GRAPE: 'ES',
    PAPAYA: 'BR',
    COCONUT: 'IN',
    PLUM: 'CA',
    TAMARIND: 'NG',
    HIPPO: 'ZW',
    GIRAFFE: 'KE',
    CHEETAH: 'TZ',
    PANDA: 'CN',
    TIGER: 'IN',
    WOLF: 'US',
    EAGLE: 'US',
    FALCON: 'GB',
    OTTER: 'CA',
    RABBIT: 'AU',
    LYNX: 'NO',
    BEAVER: 'US',
    JAGUAR: 'BR',
    PUMA: 'AR',
    BISON: 'US',
    AARDVARK: 'ZA',
    MEERKAT: 'ZA',
    QUAIL: 'FR',
    OSTRICH: 'ZA',
    HYENA: 'KE',
    IMPALA: 'TZ',
    ORYX: 'NA',
    GAZELLE: 'EG',
    ALBATROSS: 'NZ',
    DOLPHIN: 'US',
    SHARK: 'AU',
    TULIP: 'NL',
    ROSE: 'FR',
    LILLY: 'GB',
    DAISY: 'US',
    VIOLET: 'DE',
    SUNFLOWER: 'ES',
    OAK: 'US',
    MAPLE: 'CA',
    PALM: 'AE',
    ASPEN: 'US',
    PINE: 'US',
    CEDAR: 'TR',
    CARNATION: 'FR',
    BRIAR: 'GB',
    HAZEL: 'IE',
    JUNIPER: 'US',
    OCEAN: 'US',
    RIVER: 'BR',
    VALLEY: 'US',
    DESERT: 'AE',
    HILL: 'GB',
    MOUNTAIN: 'CH',
    FOREST: 'CA',
    LAKE: 'KE',
    CANYON: 'US',
    DELTA: 'EG',
    PRAIRIE: 'CA',
    ISLAND: 'TH',
    HARBOR: 'US',
    GARDEN: 'DE',
    STATION: 'GB',
    CASCADE: 'NZ',
    PLANET: 'US',
  }

  const entries = Object.entries(CITY_CODES)
  const [city, code] = entries[Math.floor(Math.random() * entries.length)]
  const number = Math.floor(100 + Math.random() * 900)
  return `${city}${code}${number}`.toUpperCase()
}

/** Gets the sticky code from the URL or local storage and persists it. */
export function getStickyCode(): string {
  if (typeof window === 'undefined') {
    return 'unknown-phone'
  }

  const params = new URLSearchParams(window.location.search)
  const tokenFromQuery =
    params.get('stickyCode') ??
    params.get('sticky_code') ??
    localStorage.getItem(STICKY_CODE_KEY)

  const token = tokenFromQuery ?? ''

  if (tokenFromQuery) {
    localStorage.setItem(STICKY_CODE_KEY, token)
  }

  return token
}
