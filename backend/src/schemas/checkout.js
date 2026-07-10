const { z } = require('zod');

const checkoutStartSchema = z.object({
  address: z.object({
    line1: z.string().optional(),
    street: z.string().optional(),
    streetAddress: z.string().optional(),
    line2: z.string().optional(),
    apartment: z.string().optional(),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    zip: z.string().optional(),
    postCode: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().min(1, "Country is required"),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional()
  }).optional()
});

const checkoutConfirmSchema = z.object({
  orderId: z.string().min(1),
  payment: z.object({
    method: z.string().optional(),
    transactionId: z.string().optional()
  }).optional()
});

module.exports = {
  checkoutStartSchema,
  checkoutConfirmSchema
};
