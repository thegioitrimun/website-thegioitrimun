import React, { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  findProvinceByName,
  findWardByName,
  loadVietnamAdministrativeUnits2025,
  type VietnamProvinceWithWards,
} from '../src/vietnamAdministrativeUnits';

export type VietnamAddressValue = {
  province: string;
  district?: string;
  ward: string;
  street: string;
};

type VietnamAddressFieldsProps = {
  value: VietnamAddressValue;
  onChange: (next: VietnamAddressValue) => void;
  inputClassName?: string;
  layoutClassName?: string;
  required?: boolean;
  showLegacyDistrict?: boolean;
};

const defaultInputClassName = 'mt-1 block w-full rounded-md border-input bg-background shadow-sm focus:border-primary focus:ring-primary';

const VietnamAddressFields: React.FC<VietnamAddressFieldsProps> = ({
  value,
  onChange,
  inputClassName = defaultInputClassName,
  layoutClassName = 'grid grid-cols-1 gap-4 sm:grid-cols-2',
  required = false,
  showLegacyDistrict = false,
}) => {
  const { t } = useTranslation();
  const id = useId().replace(/:/g, '');
  const [provinces, setProvinces] = useState<VietnamProvinceWithWards[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadVietnamAdministrativeUnits2025()
      .then((data) => {
        if (!cancelled) {
          setProvinces(data);
          setLoadError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const selectedProvince = useMemo(
    () => findProvinceByName(provinces, value.province),
    [provinces, value.province],
  );
  const selectedWard = useMemo(
    () => findWardByName(selectedProvince, value.ward),
    [selectedProvince, value.ward],
  );

  const updateProvince = (province: string) => {
    const previousProvince = findProvinceByName(provinces, value.province);
    const nextProvince = findProvinceByName(provinces, province);
    const provinceChanged = previousProvince?.code !== nextProvince?.code;
    onChange({
      ...value,
      province,
      ward: provinceChanged ? '' : value.ward,
      district: provinceChanged ? '' : value.district,
    });
  };

  return (
    <div className={layoutClassName}>
      <div>
        <label htmlFor={`${id}-province`} className="block text-sm font-medium text-muted-foreground">{t('checkout.province')}</label>
        <input
          id={`${id}-province`}
          name="province"
          value={value.province}
          onChange={(event) => updateProvince(event.target.value)}
          onBlur={(event) => {
            const match = findProvinceByName(provinces, event.target.value);
            if (match && match.name !== value.province) updateProvince(match.name);
          }}
          list={`${id}-province-list`}
          autoComplete="address-level1"
          placeholder={isLoading ? t('common.loading') : t('checkout.province_placeholder')}
          required={required}
          className={inputClassName}
        />
        <datalist id={`${id}-province-list`}>
          {provinces.map((province) => <option key={province.code} value={province.name} />)}
        </datalist>
      </div>

      <div>
        <label htmlFor={`${id}-ward`} className="block text-sm font-medium text-muted-foreground">{t('checkout.ward')}</label>
        <input
          id={`${id}-ward`}
          name="ward"
          value={value.ward}
          onChange={(event) => onChange({ ...value, ward: event.target.value })}
          onBlur={(event) => {
            const match = findWardByName(selectedProvince, event.target.value);
            if (match && match.name !== value.ward) onChange({ ...value, ward: match.name });
          }}
          list={`${id}-ward-list`}
          autoComplete="address-level3"
          placeholder={selectedProvince ? t('checkout.ward_placeholder', 'Chọn phường/xã/đặc khu') : t('checkout.select_province_first', 'Chọn tỉnh/thành phố trước')}
          disabled={isLoading || (!selectedProvince && !loadError)}
          required={required}
          className={inputClassName}
        />
        <datalist id={`${id}-ward-list`}>
          {(selectedProvince?.wards || []).map((ward) => <option key={ward.code} value={ward.name} />)}
        </datalist>
        {!isLoading && selectedProvince && value.ward && !selectedWard ? (
          <p className="mt-1 text-xs font-semibold text-amber-700">
            {t('checkout.select_current_ward')}
          </p>
        ) : null}
      </div>

      <div className={showLegacyDistrict ? '' : 'hidden'}>
        <label htmlFor={`${id}-district`} className="block text-sm font-medium text-muted-foreground">{t('checkout.district_legacy')}</label>
        <input
          id={`${id}-district`}
          name="district"
          value={value.district || ''}
          onChange={(event) => onChange({ ...value, district: event.target.value })}
          autoComplete="address-level2"
          className={inputClassName}
        />
      </div>

      <div className={showLegacyDistrict ? '' : 'sm:col-span-2'}>
        <label htmlFor={`${id}-street`} className="block text-sm font-medium text-muted-foreground">{t('checkout.street')}</label>
        <input
          id={`${id}-street`}
          name="street"
          value={value.street}
          onChange={(event) => onChange({ ...value, street: event.target.value })}
          autoComplete="street-address"
          required={required}
          className={inputClassName}
        />
      </div>

      <p className="sm:col-span-2 text-xs leading-5 text-muted-foreground">
        {t('checkout.two_tier_address_notice', 'Địa chỉ mới sử dụng hai cấp: Tỉnh/Thành phố và Phường/Xã/Đặc khu.')}
      </p>
      {loadError ? (
        <p role="alert" className="sm:col-span-2 text-xs font-semibold text-destructive">
          {t('checkout.address_data_error', 'Không thể tải danh mục địa chỉ. Bạn vẫn có thể nhập địa chỉ thủ công.')}
        </p>
      ) : null}
    </div>
  );
};

export default VietnamAddressFields;
