import api from "./api";

export interface WilayahItem {
  id: string;
  name: string;
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
};
