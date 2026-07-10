const { z } = require('zod');

const trendingEventSchema = z.object({
  eventType: z.enum(['view', 'add-to-cart', 'purchase']),
  productId: z.string().min(1)
});

module.exports = {
  trendingEventSchema
};
