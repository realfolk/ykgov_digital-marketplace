import { makePageMetadata } from 'front-end/lib';
import { Route, SharedState } from 'front-end/lib/app/types';
import { ComponentView, GlobalComponentMsg, PageComponent, PageInit, Update } from 'front-end/lib/framework';
import { HorizontalCard } from 'front-end/lib/views/horizontal-card';
import Link, { routeDest } from 'front-end/lib/views/link';
import makeInstructionalSidebar from 'front-end/lib/views/sidebar/instructional';
import React from 'react';
import { Col, Row } from 'reactstrap';
import { ADT, adt } from 'shared/lib/types';

export interface State {
  empty: true;
}

export type Msg = GlobalComponentMsg<ADT<'noop'>, Route>;

export type RouteParams = null;

const init: PageInit<RouteParams, SharedState, State, Msg> = async () => ({ empty: true });

const update: Update<State, Msg> = ({ state, msg }) => {
  return [state];
};

const view: ComponentView<State, Msg> = ({ state }) => {
  return (
    <div>
      <Row className='pb-4'>
        <Col xs='12' className='mx-auto'>
          <h2>Sign In</h2>
          <p>Select one of the options available below to sign in to your Digital Marketplace account.</p>
        </Col>
      </Row>
      <HorizontalCard
        signInTarget='github'
        title='Vendor'
        description='Use your GitHub account to sign in to the Digital Marketplace.'
        buttonText='Sign Up Using GitHub' />

      <HorizontalCard
        signInTarget='idir'
        title='Public Sector Employee'
        description='Use your IDIR to sign in to the Digital Marketplace.'
        buttonText='Sign Up Using IDIR' />
    </div>
  );
};

export const component: PageComponent<RouteParams, SharedState, State, Msg> = {
  init,
  update,
  view,
  sidebar: {
    size: 'large',
    color: 'light-blue',
    view: makeInstructionalSidebar<State, Msg>({
      showBackLink: true,
      getTitle: () => 'Welcome Back to the Digital Marketplace',
      getDescription: () => 'Pleas sign in to access your Digital Marketplace account.',
      getFooter: () => (
        <span>
          Don't have an account?&nbsp;
          <Link dest={routeDest(adt('signUpStepOne', null))}>Sign up</Link>.
        </span>
      )
    })
  },
  getMetadata() {
    return makePageMetadata('Signed Out');
  }
};
