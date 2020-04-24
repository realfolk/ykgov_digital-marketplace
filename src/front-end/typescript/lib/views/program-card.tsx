import { View, ViewElement } from 'front-end/lib/framework';
import Link, { ButtonProps } from 'front-end/lib/views/link';
import React from 'react';
import { Col } from 'reactstrap';

export interface Props {
  img: string;
  title: string;
  description: ViewElement;
  className?: string;
  links: ButtonProps[];
  wideLinks?: boolean;
}

const ProgramCard: View<Props> = ({ img, title, description, links, wideLinks }) => {
  return (
    <Col xs='12' md='6' className='mb-4 mb-md-0'>
      <div className='d-flex flex-column align-items-center bg-white rounded-lg border p-4 p-sm-5 text-center h-100'>
        <img src={img} className='w-100' style={{ maxHeight: '200px' }} alt={`${title} Image`} />
        <h1 className='my-4'>{title}</h1>
        <p className='mb-4 mb-sm-5'>{description}</p>
        <div className={`mt-auto d-flex flex-column ${wideLinks ? 'align-self-stretch' : ''} `}>
          {links.map((link, index) => (
            <Link
              {...link}
              className={`justify-content-center ${index < links.length - 1 ? 'mb-3' : ''}`}
              key={`program-card-link-${index}`}
            />
          ))}
        </div>
      </div>
    </Col>
  );
};

export default ProgramCard;