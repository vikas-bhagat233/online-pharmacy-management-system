const Delivery = require('../models/delivery');
const Order = require('../models/Order');

exports.assignDelivery = async (req, res) => {
  const { orderId, agentId, deliveryAgent } = req.body;
  const trackingNumber = 'TRK' + Date.now();

  const agentObj = deliveryAgent && typeof deliveryAgent === 'object'
    ? {
      name: String(deliveryAgent.name || '').trim(),
      phone: String(deliveryAgent.phone || '').trim(),
      vehicleNumber: String(deliveryAgent.vehicleNumber || '').trim()
    }
    : {
      name: String(req.body?.name || '').trim(),
      phone: String(req.body?.phone || '').trim(),
      vehicleNumber: String(req.body?.vehicleNumber || '').trim()
    };
  
  const delivery = await Delivery.create({
    order: orderId,
    trackingNumber,
    deliveryAgent: agentObj,
    status: 'assigned'
  });
  
  res.json(delivery);
};

exports.updateLocation = async (req, res) => {
  const { deliveryId, lat, lng, status } = req.body;
  
  const delivery = await Delivery.findByIdAndUpdate(
    deliveryId,
    { 
      'currentLocation': { lat, lng },
      status,
      $push: { updates: { status, location: { lat, lng } } }
    },
    { new: true }
  );
  
  // Emit real-time update
  req.io.to(`delivery-${deliveryId}`).emit('locationUpdate', delivery);
  
  res.json(delivery);
};

exports.trackDelivery = async (req, res) => {
  const { trackingNumber } = req.params;
  const delivery = await Delivery.findOne({ trackingNumber })
    .populate('order')
    .populate('deliveryAgent');
  
  res.json(delivery);
};