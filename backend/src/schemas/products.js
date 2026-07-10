const { z } = require('zod');

const productSchema = z.object({
  name: z.string().min(1),
  categoryId: z.string().min(1),
  vendorId: z.string().min(1),
  price: z.object({
    amount: z.number().positive(),
    currency: z.string().optional().default('INR'),
    compareAt: z.number().optional()
  }),
  sku: z.string().optional(),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  brand: z.string().optional().default('Generic'),
  images: z.array(z.object({
    url: z.string(),
    alt: z.string(),
    isPrimary: z.boolean().optional()
  })).optional(),
  attributes: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
  inventory: z.object({
    quantity: z.number().int().optional().default(100),
    warehouse: z.string().optional().default('HYD-WH-01')
  }).optional()
});

module.exports = {
  productSchema
};
