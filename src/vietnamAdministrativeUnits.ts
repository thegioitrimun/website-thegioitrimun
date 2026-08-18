export type VietnamProvince = {
  code: string;
  name: string;
  type: 'city' | 'province';
};

export type VietnamWard = {
  code: number;
  name: string;
  type: string;
};

export type VietnamProvinceWithWards = {
  code: number;
  name: string;
  type: string;
  wards: VietnamWard[];
};

// Vietnam has 34 province-level administrative units from 2025-07-01.
// Keep this list centralized so checkout, profile and shipping flows can reuse it.
export const VIETNAM_PROVINCES_2025: VietnamProvince[] = [
  { code: 'ha-noi', name: 'Thành phố Hà Nội', type: 'city' },
  { code: 'hue', name: 'Thành phố Huế', type: 'city' },
  { code: 'hai-phong', name: 'Thành phố Hải Phòng', type: 'city' },
  { code: 'da-nang', name: 'Thành phố Đà Nẵng', type: 'city' },
  { code: 'can-tho', name: 'Thành phố Cần Thơ', type: 'city' },
  { code: 'ho-chi-minh', name: 'Thành phố Hồ Chí Minh', type: 'city' },
  { code: 'tuyen-quang', name: 'Tỉnh Tuyên Quang', type: 'province' },
  { code: 'lao-cai', name: 'Tỉnh Lào Cai', type: 'province' },
  { code: 'thai-nguyen', name: 'Tỉnh Thái Nguyên', type: 'province' },
  { code: 'phu-tho', name: 'Tỉnh Phú Thọ', type: 'province' },
  { code: 'bac-ninh', name: 'Tỉnh Bắc Ninh', type: 'province' },
  { code: 'hung-yen', name: 'Tỉnh Hưng Yên', type: 'province' },
  { code: 'ninh-binh', name: 'Tỉnh Ninh Bình', type: 'province' },
  { code: 'quang-tri', name: 'Tỉnh Quảng Trị', type: 'province' },
  { code: 'quang-ngai', name: 'Tỉnh Quảng Ngãi', type: 'province' },
  { code: 'gia-lai', name: 'Tỉnh Gia Lai', type: 'province' },
  { code: 'khanh-hoa', name: 'Tỉnh Khánh Hòa', type: 'province' },
  { code: 'lam-dong', name: 'Tỉnh Lâm Đồng', type: 'province' },
  { code: 'dak-lak', name: 'Tỉnh Đắk Lắk', type: 'province' },
  { code: 'dong-nai', name: 'Tỉnh Đồng Nai', type: 'province' },
  { code: 'tay-ninh', name: 'Tỉnh Tây Ninh', type: 'province' },
  { code: 'vinh-long', name: 'Tỉnh Vĩnh Long', type: 'province' },
  { code: 'dong-thap', name: 'Tỉnh Đồng Tháp', type: 'province' },
  { code: 'ca-mau', name: 'Tỉnh Cà Mau', type: 'province' },
  { code: 'an-giang', name: 'Tỉnh An Giang', type: 'province' },
  { code: 'cao-bang', name: 'Tỉnh Cao Bằng', type: 'province' },
  { code: 'dien-bien', name: 'Tỉnh Điện Biên', type: 'province' },
  { code: 'ha-tinh', name: 'Tỉnh Hà Tĩnh', type: 'province' },
  { code: 'lai-chau', name: 'Tỉnh Lai Châu', type: 'province' },
  { code: 'lang-son', name: 'Tỉnh Lạng Sơn', type: 'province' },
  { code: 'nghe-an', name: 'Tỉnh Nghệ An', type: 'province' },
  { code: 'quang-ninh', name: 'Tỉnh Quảng Ninh', type: 'province' },
  { code: 'thanh-hoa', name: 'Tỉnh Thanh Hóa', type: 'province' },
  { code: 'son-la', name: 'Tỉnh Sơn La', type: 'province' },
];

export const isVietnamProvince2025 = (value: string): boolean => {
  const normalized = normalizeAdministrativeName(value);
  return VIETNAM_PROVINCES_2025.some(
    (province) => normalizeAdministrativeName(province.name) === normalized,
  );
};

let administrativeUnitsPromise: Promise<VietnamProvinceWithWards[]> | null = null;

export const loadVietnamAdministrativeUnits2025 = (): Promise<VietnamProvinceWithWards[]> => {
  if (!administrativeUnitsPromise) {
    administrativeUnitsPromise = fetch('/data/vietnam-administrative-units-2025.json', {
      credentials: 'same-origin',
      cache: 'force-cache',
    }).then(async (response) => {
      if (!response.ok) throw new Error('Could not load Vietnam administrative units.');
      const data = await response.json();
      if (!Array.isArray(data) || data.length !== 34) {
        throw new Error('Vietnam administrative dataset is invalid.');
      }
      return data as VietnamProvinceWithWards[];
    }).catch((error) => {
      administrativeUnitsPromise = null;
      throw error;
    });
  }
  return administrativeUnitsPromise;
};

export const normalizeAdministrativeName = (value: string): string =>
  String(value || '')
    .trim()
    .toLocaleLowerCase('vi-VN')
    .replace(/^(thành phố|tỉnh|phường|xã|đặc khu|thị trấn)\s+/u, '')
    .replace(/\s+/g, ' ');

export const findProvinceByName = (
  provinces: VietnamProvinceWithWards[],
  value: string,
): VietnamProvinceWithWards | undefined => {
  const normalized = normalizeAdministrativeName(value);
  return provinces.find((province) => normalizeAdministrativeName(province.name) === normalized);
};

export const findWardByName = (
  province: VietnamProvinceWithWards | undefined,
  value: string,
): VietnamWard | undefined => {
  if (!province) return undefined;
  const normalized = normalizeAdministrativeName(value);
  return province.wards.find((ward) => normalizeAdministrativeName(ward.name) === normalized);
};
