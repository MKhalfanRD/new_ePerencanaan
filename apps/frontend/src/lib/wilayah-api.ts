import api from "./api";

export interface WilayahItem {
  id: string;
  name: string;
}

export interface ReverseGeocodeResult {
  provinceId?: string;
  provinceName?: string;
  cityId?: string;
  cityName?: string;
  districtId?: string;
  districtName?: string;
  villageId?: string;
  villageName?: string;
  matchedLevel: "village" | "district" | "city" | "province" | "none";
  displayName?: string;
}

export interface LocationSearchResult {
  displayName: string;
  lat: number;
  lng: number;
}

export const wilayahApi = {
  getProvinces: () =>
    api.get<WilayahItem[]>("/wilayah/provinces").then((r) => r.data),
  getRegencies: (provinceId: string) =>
    api
      .get<WilayahItem[]>(`/wilayah/regencies/${provinceId}`)
      .then((r) => r.data),
  getDistricts: (regencyId: string) =>
    api
      .get<WilayahItem[]>(`/wilayah/districts/${regencyId}`)
      .then((r) => r.data),
  getVillages: (districtId: string) =>
    api
      .get<WilayahItem[]>(`/wilayah/villages/${districtId}`)
      .then((r) => r.data),
  reverseGeocode: (lat: number, lng: number) =>
    api
      .get<ReverseGeocodeResult>("/wilayah/reverse", { params: { lat, lng } })
      .then((r) => r.data),
  searchLocation: (q: string) =>
    api
      .get<LocationSearchResult[]>("/wilayah/search", { params: { q } })
      .then((r) => r.data),
};
