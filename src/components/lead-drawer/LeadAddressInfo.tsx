// src/components/lead-drawer/LeadAddressInfo.tsx
import { forwardRef, useImperativeHandle, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

import type { Lead, CreateLeadPayload } from '@/types/crmTypes';
import type { PartialLeadFormHandle } from '../LeadsFormDrawer';

const leadAddressSchema = z.object({
  address_line1: z.string().max(255, 'Address line 1 is too long').optional(),
  address_line2: z.string().max(255, 'Address line 2 is too long').optional(),
  city: z.string().max(100, 'City name is too long').optional(),
  state: z.string().max(100, 'State name is too long').optional(),
  postal_code: z.string().max(20, 'Postal code is too long').optional(),
  country: z.string().max(100, 'Country name is too long').optional(),
});

type LeadAddressFormData = z.infer<typeof leadAddressSchema>;

interface LeadAddressInfoProps {
  lead?: Lead | null;
  mode: 'view' | 'edit' | 'create';
}

const LeadAddressInfo = forwardRef<PartialLeadFormHandle, LeadAddressInfoProps>(
  ({ lead, mode }, ref) => {
    const isReadOnly = mode === 'view';

    const {
      control,
      handleSubmit,
      reset,
      formState: { errors },
    } = useForm<LeadAddressFormData>({
      resolver: zodResolver(leadAddressSchema),
      defaultValues: {
        address_line1: '',
        address_line2: '',
        city: '',
        state: '',
        postal_code: '',
        country: '',
      },
    });

    // Update form when lead data changes
    useEffect(() => {
      if (lead) {
        reset({
          address_line1: lead.address_line1 || '',
          address_line2: lead.address_line2 || '',
          city: lead.city || '',
          state: lead.state || '',
          postal_code: lead.postal_code || '',
          country: lead.country || '',
        });
      } else if (mode === 'create') {
        reset({
          address_line1: '',
          address_line2: '',
          city: '',
          state: '',
          postal_code: '',
          country: '',
        });
      }
    }, [lead, mode, reset]);

    // Expose getFormValues to parent
    useImperativeHandle(ref, () => ({
      getFormValues: async (): Promise<Partial<CreateLeadPayload> | null> => {
        return new Promise((resolve) => {
          handleSubmit(
            (data) => {
              // Clean up empty strings to undefined
              const cleanData: Partial<CreateLeadPayload> = {
                address_line1: data.address_line1 || undefined,
                address_line2: data.address_line2 || undefined,
                city: data.city || undefined,
                state: data.state || undefined,
                postal_code: data.postal_code || undefined,
                country: data.country || undefined,
              };
              resolve(cleanData);
            },
            () => {
              resolve(null);
            }
          )();
        });
      },
    }));

    return (
      <div className="space-y-6">
        {/* Address Line 1 */}
        <div className="space-y-2">
          <Label htmlFor="address_line1" className={errors.address_line1 ? 'text-destructive' : ''}>
            Address Line 1
          </Label>
          <Controller
            name="address_line1"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                id="address_line1"
                placeholder="123 Main Street"
                disabled={isReadOnly}
                className={errors.address_line1 ? 'border-destructive' : ''}
              />
            )}
          />
          {errors.address_line1 && (
            <p className="text-sm text-destructive">{errors.address_line1.message}</p>
          )}
        </div>

        {/* Address Line 2 */}
        <div className="space-y-2">
          <Label htmlFor="address_line2" className={errors.address_line2 ? 'text-destructive' : ''}>
            Address Line 2
          </Label>
          <Controller
            name="address_line2"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                id="address_line2"
                placeholder="Apartment, suite, unit, etc."
                disabled={isReadOnly}
                className={errors.address_line2 ? 'border-destructive' : ''}
              />
            )}
          />
          {errors.address_line2 && (
            <p className="text-sm text-destructive">{errors.address_line2.message}</p>
          )}
        </div>

        {/* City */}
        <div className="space-y-2">
          <Label htmlFor="city" className={errors.city ? 'text-destructive' : ''}>
            City
          </Label>
          <Controller
            name="city"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                id="city"
                placeholder="New York"
                disabled={isReadOnly}
                className={errors.city ? 'border-destructive' : ''}
              />
            )}
          />
          {errors.city && (
            <p className="text-sm text-destructive">{errors.city.message}</p>
          )}
        </div>

        {/* State & Postal Code */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="state" className={errors.state ? 'text-destructive' : ''}>
              State / Province
            </Label>
            <Controller
              name="state"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  id="state"
                  placeholder="NY"
                  disabled={isReadOnly}
                  className={errors.state ? 'border-destructive' : ''}
                />
              )}
            />
            {errors.state && (
              <p className="text-sm text-destructive">{errors.state.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="postal_code" className={errors.postal_code ? 'text-destructive' : ''}>
              Postal Code
            </Label>
            <Controller
              name="postal_code"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  id="postal_code"
                  placeholder="10001"
                  disabled={isReadOnly}
                  className={errors.postal_code ? 'border-destructive' : ''}
                />
              )}
            />
            {errors.postal_code && (
              <p className="text-sm text-destructive">{errors.postal_code.message}</p>
            )}
          </div>
        </div>

        {/* Country */}
        <div className="space-y-2">
          <Label htmlFor="country" className={errors.country ? 'text-destructive' : ''}>
            Country
          </Label>
          <Controller
            name="country"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                id="country"
                placeholder="United States"
                disabled={isReadOnly}
                className={errors.country ? 'border-destructive' : ''}
              />
            )}
          />
          {errors.country && (
            <p className="text-sm text-destructive">{errors.country.message}</p>
          )}
        </div>
      </div>
    );
  }
);

LeadAddressInfo.displayName = 'LeadAddressInfo';

export default LeadAddressInfo;