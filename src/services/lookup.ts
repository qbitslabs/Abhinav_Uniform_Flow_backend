import { FilterQuery, Model } from 'mongoose';
import { isObjectId } from '../utils/helpers';
import { ApiError } from '../utils/ApiError';

export async function findByPublicId<T>(
  model: Model<T>,
  id: string,
  extraFields: string[] = []
): Promise<T | null> {
  const ors: FilterQuery<T>[] = [{ customId: id } as FilterQuery<T>];
  for (const field of extraFields) {
    ors.push({ [field]: id } as FilterQuery<T>);
  }
  if (isObjectId(id)) {
    ors.push({ _id: id } as FilterQuery<T>);
  }
  return model.findOne({ $or: ors });
}

export async function findByPublicIdOrThrow<T>(
  model: Model<T>,
  id: string,
  label: string,
  extraFields: string[] = []
): Promise<T> {
  const doc = await findByPublicId(model, id, extraFields);
  if (!doc) throw ApiError.notFound(`${label} not found`);
  return doc;
}
