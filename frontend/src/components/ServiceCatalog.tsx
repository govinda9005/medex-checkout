import React from 'react';
import { Service } from '../types/api';

interface ServiceCatalogProps {
  services: Service[];
  cartServiceIds: Set<string>;
  onAddToCart: (serviceId: string) => void;
}

export const ServiceCatalog: React.FC<ServiceCatalogProps> = ({
  services,
  cartServiceIds,
  onAddToCart
}) => {
  const formatType = (type: string) => {
    switch (type) {
      case 'lab_test':
        return 'Lab Test';
      case 'package':
        return 'Package';
      case 'wellness':
        return 'Wellness';
      default:
        return 'Service';
    }
  };

  return (
    <section className="catalog-section">
      <h2 className="section-title">Available Healthcare Services</h2>
      <div className="services-grid">
        {services.map((service) => {
          const inCart = cartServiceIds.has(service.id);
          return (
            <div key={service.id} className="service-card">
              <div className="service-header">
                <span className={`badge badge-${service.type}`}>
                  {formatType(service.type)}
                </span>
                <span className="service-id">{service.id}</span>
              </div>
              <h3 className="service-title">{service.title}</h3>
              <p className="service-provider">{service.providerName}</p>
              <div className="service-footer">
                <div className="price-tag">
                  <span className="currency">฿</span>
                  <span className="amount">{service.price}</span>
                </div>
                <button
                  type="button"
                  className={`btn-add ${inCart ? 'in-cart' : ''}`}
                  onClick={() => onAddToCart(service.id)}
                >
                  {inCart ? 'Add More' : '+ Add to Cart'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
