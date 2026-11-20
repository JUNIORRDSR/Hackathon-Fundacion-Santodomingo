export type WasteType = 'organico' | 'reciclable';
export type GeneratorType = 'hogar' | 'unidad_productiva';

export const COLLECTION_FIELD_LIMITS = { address: 120, availability: 80, notes: 160 } as const;

const coordinators = {
  organico: 'huerteros',
  reciclable: 'recicladores',
} as const;

export interface CollectionRequest {
  requestId: string;
  contactPhone: string;
  wasteType: WasteType;
  generatorType: GeneratorType;
  address: string;
  availability: string;
  notes: string;
  coordinator: (typeof coordinators)[WasteType];
  source: 'whatsapp';
}

export type CollectionDetails = Pick<
  CollectionRequest, 'wasteType' | 'generatorType' | 'address' | 'availability' | 'notes'
>;

export function collectionRequest(
  requestId: string,
  contactPhone: string,
  details: CollectionDetails,
): CollectionRequest {
  return { requestId, contactPhone, ...details, coordinator: coordinators[details.wasteType], source: 'whatsapp' };
}

export function isContactPhone(value: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(value);
}
