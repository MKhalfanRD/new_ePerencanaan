"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { wilayahApi, WilayahItem } from "@/lib/wilayah-api";

export interface WilayahValue {
  provinceId?: string;
  provinceName?: string;
  cityId?: string;
  cityName?: string;
  districtId?: string;
  districtName?: string;
  villageId?: string;
  villageName?: string;
}

interface Props {
  value: WilayahValue;
  onChange: (value: WilayahValue) => void;
}

export function CascadingWilayah({ value, onChange }: Props) {
  const [provinces, setProvinces] = useState<WilayahItem[]>([]);
  const [regencies, setRegencies] = useState<WilayahItem[]>([]);
  const [districts, setDistricts] = useState<WilayahItem[]>([]);
  const [villages, setVillages] = useState<WilayahItem[]>([]);
  const [loading, setLoading] = useState({
    province: false,
    regency: false,
    district: false,
    village: false,
  });

  // Load provinsi sekali di awal
  useEffect(() => {
    setLoading((p) => ({ ...p, province: true }));
    wilayahApi
      .getProvinces()
      .then(setProvinces)
      .finally(() => setLoading((p) => ({ ...p, province: false })));
  }, []);

  // Load kota saat provinsi berubah
  useEffect(() => {
    if (!value.provinceId) {
      setRegencies([]);
      return;
    }
    setLoading((p) => ({ ...p, regency: true }));
    wilayahApi
      .getRegencies(value.provinceId)
      .then(setRegencies)
      .finally(() => setLoading((p) => ({ ...p, regency: false })));
  }, [value.provinceId]);

  // Load kecamatan saat kota berubah
  useEffect(() => {
    if (!value.cityId) {
      setDistricts([]);
      return;
    }
    setLoading((p) => ({ ...p, district: true }));
    wilayahApi
      .getDistricts(value.cityId)
      .then(setDistricts)
      .finally(() => setLoading((p) => ({ ...p, district: false })));
  }, [value.cityId]);

  // Load desa saat kecamatan berubah
  useEffect(() => {
    if (!value.districtId) {
      setVillages([]);
      return;
    }
    setLoading((p) => ({ ...p, village: true }));
    wilayahApi
      .getVillages(value.districtId)
      .then(setVillages)
      .finally(() => setLoading((p) => ({ ...p, village: false })));
  }, [value.districtId]);

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label className="text-xs flex items-center gap-1.5">
          Provinsi{" "}
          {loading.province && <Loader2 size={11} className="animate-spin" />}
        </Label>
        <Select
          value={value.provinceId || ""}
          onValueChange={(id) => {
            const item = provinces.find((p) => p.id === id);
            onChange({ provinceId: id, provinceName: item?.name });
          }}
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Pilih provinsi" />
          </SelectTrigger>
          <SelectContent>
            {provinces.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs flex items-center gap-1.5">
          Kota/Kabupaten{" "}
          {loading.regency && <Loader2 size={11} className="animate-spin" />}
        </Label>
        <Select
          value={value.cityId || ""}
          disabled={!value.provinceId}
          onValueChange={(id) => {
            const item = regencies.find((r) => r.id === id);
            onChange({
              ...value,
              cityId: id,
              cityName: item?.name,
              districtId: undefined,
              districtName: undefined,
              villageId: undefined,
              villageName: undefined,
            });
          }}
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Pilih kota/kabupaten" />
          </SelectTrigger>
          <SelectContent>
            {regencies.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs flex items-center gap-1.5">
          Kecamatan{" "}
          {loading.district && <Loader2 size={11} className="animate-spin" />}
        </Label>
        <Select
          value={value.districtId || ""}
          disabled={!value.cityId}
          onValueChange={(id) => {
            const item = districts.find((d) => d.id === id);
            onChange({
              ...value,
              districtId: id,
              districtName: item?.name,
              villageId: undefined,
              villageName: undefined,
            });
          }}
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Pilih kecamatan" />
          </SelectTrigger>
          <SelectContent>
            {districts.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs flex items-center gap-1.5">
          Desa/Kelurahan{" "}
          {loading.village && <Loader2 size={11} className="animate-spin" />}
        </Label>
        <Select
          value={value.villageId || ""}
          disabled={!value.districtId}
          onValueChange={(id) => {
            const item = villages.find((v) => v.id === id);
            onChange({ ...value, villageId: id, villageName: item?.name });
          }}
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Pilih desa/kelurahan" />
          </SelectTrigger>
          <SelectContent>
            {villages.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
