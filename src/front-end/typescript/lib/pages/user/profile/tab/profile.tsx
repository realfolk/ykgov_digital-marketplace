import { makeStartLoading, makeStopLoading } from 'front-end/lib';
import { Route } from 'front-end/lib/app/types';
import * as Checkbox from 'front-end/lib/components/form-field/checkbox';
import { ComponentView, GlobalComponentMsg, Immutable, immutable, Init, mapComponentDispatch, newRoute, Update, updateComponentChild, View, ViewElementChildren } from 'front-end/lib/framework';
import * as api from 'front-end/lib/http/api';
import { userStatusToColor, userStatusToTitleCase, userTypeToPermissions, userTypeToTitleCase } from 'front-end/lib/pages/user/lib';
import * as ProfileForm from 'front-end/lib/pages/user/lib/components/profile-form';
import * as Tab from 'front-end/lib/pages/user/profile/tab';
import Badge from 'front-end/lib/views/badge';
import Icon from 'front-end/lib/views/icon';
import Link, { iconLinkSymbol, leftPlacement } from 'front-end/lib/views/link';
import LoadingButton from 'front-end/lib/views/loading-button';
import React, { Fragment } from 'react';
import { Col, Row } from 'reactstrap';
//import { sleep } from 'shared/lib';
import { isAdmin, isPublicSectorEmployee, User } from 'shared/lib/resources/user';
import { adt, ADT, Id } from 'shared/lib/types';

export interface Params {
  profileUser: User;
  viewerUser: User;
}

export interface State extends Params {
  saveChangesLoading: number;
  deactivateAccountLoading: number;
  startEditingFormLoading: number;
  isEditingForm: boolean;
  profileForm: Immutable<ProfileForm.State>;
  adminCheckbox: Immutable<Checkbox.State>; //TODO
  editingAdminCheckbox: boolean; //TODO
}

type InnerMsg
  = ADT<'profileForm', ProfileForm.Msg>
  | ADT<'startEditingForm'>
  | ADT<'cancelEditingForm'>
  | ADT<'saveChanges'>
  | ADT<'deactivateAccount'>
  | ADT<'adminCheckbox', Checkbox.Msg> //TODO
  | ADT<'finishEditingAdminCheckbox', undefined> //TODO
  | ADT<'editingAdminCheckbox', undefined>; //TODO

export type Msg = GlobalComponentMsg<InnerMsg, Route>;

async function resetProfileForm(user: User): Promise<Immutable<ProfileForm.State>> {
  return immutable(await ProfileForm.init(adt('update', user)));
}

function usersAreEquivalent(a: User, b: User): boolean {
  return a.id === b.id;
}

const init: Init<Params, State> = async ({ viewerUser, profileUser }) => {
  return {
    viewerUser,
    profileUser,
    saveChangesLoading: 0,
    deactivateAccountLoading: 0,
    startEditingFormLoading: 0,
    isEditingForm: false,
    profileForm: await resetProfileForm(profileUser),
    editingAdminCheckbox: false,
    adminCheckbox: immutable(await Checkbox.init({
      errors: [],
      child: {
        value: isAdmin(profileUser),
        id: 'user-admin-checkbox'
      }
    }))
  };
};

const startStartEditingFormLoading = makeStartLoading<State>('startEditingFormLoading');
const stopStartEditingFormLoading = makeStopLoading<State>('startEditingFormLoading');
const startSaveChangesLoading = makeStartLoading<State>('saveChangesLoading');
const stopSaveChangesLoading = makeStopLoading<State>('saveChangesLoading');
const startDeactivateAccountLoading = makeStartLoading<State>('deactivateAccountLoading');
const stopDeactivateAccountLoading = makeStopLoading<State>('deactivateAccountLoading');

const update: Update<State, Msg> = ({ state, msg }) => {
  switch (msg.tag) {
    case 'profileForm':
      return updateComponentChild({
        state,
        childStatePath: ['profileForm'],
        childUpdate: ProfileForm.update,
        childMsg: msg.value,
        mapChildMsg: value => adt('profileForm', value)
      });
    case 'startEditingForm':
      return [
        startStartEditingFormLoading(state),
        async state => {
          state = stopStartEditingFormLoading(state);
          // Reload the profile user before editing.
          const result = await api.users.readOne(state.profileUser.id);
          if (!api.isValid(result)) { return state; } // Do not allow editing if fetching the user failed.
          state = state
            .set('isEditingForm', true)
            .set('profileUser', result.value)
            .set('profileForm', await resetProfileForm(result.value));
          return state;
        }
      ];
    case 'cancelEditingForm':
      return [
        state,
        async state => {
          return state
            .set('isEditingForm', false)
            .set('profileForm', await resetProfileForm(state.profileUser));
        }
      ];
    case 'saveChanges':
      return [
        startSaveChangesLoading(state),
        async state => {
          state = stopSaveChangesLoading(state);
          const values = ProfileForm.getValues(state.profileForm);
          let avatarImageFile: Id | undefined = state.profileUser.avatarImageFile && state.profileUser.avatarImageFile.id;
          if (values.newAvatarImage) {
            const fileResult = await api.files.create({
              name: values.newAvatarImage.name,
              file: values.newAvatarImage,
              metadata: [adt('any')]
            });
            switch (fileResult.tag) {
              case 'valid':
                avatarImageFile = fileResult.value.id;
                break;
              case 'unhandled':
              case 'invalid':
                return state.update('profileForm', v => ProfileForm.setErrors(v, {
                  newAvatarImage: ['Please select a different avatar image.']
                }));
            }
          }
          const result = await api.users.update(state.profileUser.id, {
            name: values.name,
            email: values.email,
            jobTitle: values.jobTitle,
            avatarImageFile
          });
          switch (result.tag) {
            case 'invalid':
              return state.update('profileForm', v => ProfileForm.setErrors(v, result.value));
            case 'unhandled':
              return state;
            case 'valid':
              return state
                .set('isEditingForm', false)
                .set('profileUser', result.value)
                .set('profileForm', await resetProfileForm(result.value));
          }
        }
      ];
    case 'deactivateAccount':
      return [
        startDeactivateAccountLoading(state),
        async (state, dispatch) => {
          state = stopDeactivateAccountLoading(state);
          const result = await api.users.delete(state.profileUser.id);
          switch (result.tag) {
            case 'valid':
              dispatch(newRoute(adt('signOut' as const, null)));
              return state;
            case 'invalid':
            case 'unhandled':
              return state;
          }
        }
      ];
    case 'finishEditingAdminCheckbox':
      return [state.set('editingAdminCheckbox', false),
        async state => {
          const result = await api.users.update(state.profileUser.id, {});  // TODO(Jesse): Serialize form and pass to backend
          if (api.isValid(result)) {
            state.set('profileUser', result.value);
          }
          return state;
        }
      ];
    case 'editingAdminCheckbox':
      return [state.set('editingAdminCheckbox', true)];
    case 'adminCheckbox':
      return updateComponentChild({
        state,
        childStatePath: ['adminCheckbox'],
        childUpdate: Checkbox.update,
        childMsg: msg.value,
        mapChildMsg: value => adt('adminCheckbox', value)
      });
    default:
      return [state];
  }
};

interface ViewDetailProps {
  name: string;
  children: ViewElementChildren;
  className?: string;
}

const ViewDetail: View<ViewDetailProps> = ({ className = '', name, children }) => {
  return (
    <div className={`d-flex flex-row flex-nowrap align-items-stretch ${className}`}>
      <div className='font-weight-bold align-self-start'>{name}:</div>
      <div className='ml-3 d-flex align-items-center'>{children}</div>
    </div>
  );
};

const ViewPermissionsAsGovernment: ComponentView<State, Msg> = ({ state }) => {
  const permissions = userTypeToPermissions(state.profileUser.type);
  if (!permissions.length) { return null; }
  return (
    <ViewDetail name='Permission(s)'>
      {permissions.map((p, i) => (
        <Badge
          pill
          className={i === permissions.length ? '' : 'mr-2'}
          key={`user-permission-pill-${i}`}
          text={p}
          color='permissions' />
      ))}
    </ViewDetail>
  );
};

const ViewPermissionsAsAdmin: ComponentView<State, Msg> = ({ state, dispatch }) => {
  return (
    <ViewDetail name='Permission(s)'>
      <div className='d-flex align-items-center'>
        <Checkbox.view
          extraChildProps={{inlineLabel: 'Admin'}}
          className='mb-0 mr-3'
          disabled={!state.editingAdminCheckbox}
          state={state.adminCheckbox}
          dispatch={mapComponentDispatch(dispatch, value => adt('adminCheckbox' as const, value))} />
        {state.editingAdminCheckbox
          ? (<Icon
               name='check'
               color='success'
               hover
               onClick={() => dispatch(adt('finishEditingAdminCheckbox'))} />)
          : (<Icon
               name='edit'
               color='primary'
               hover
               style={{ cursor: 'pointer' }}
               onClick={() => dispatch(adt('editingAdminCheckbox'))} />)}
      </div>
    </ViewDetail>
  );
};

const ViewPermissions: ComponentView<State, Msg> = props => {
  const { state } = props;
  const profileUser = state.profileUser;
  const isOwner = usersAreEquivalent(profileUser, state.viewerUser);
  const isPSE = isPublicSectorEmployee(profileUser);
  if (isPSE && isOwner) {
    return (<div className='mt-3'><ViewPermissionsAsGovernment {...props} /></div>);
  } else if (isPSE && !isOwner) {
    return (<div className='mt-3'><ViewPermissionsAsAdmin {...props} /></div>);
  } else {
    return null;
  }
};

const ViewDetails: ComponentView<State, Msg> = props => {
  const profileUser = props.state.profileUser;
  return (
    <Row>
      <Col xs='12'>
        <div className='pb-5 mb-5 border-bottom'>
          {isAdmin(props.state.viewerUser)
            ? (<ViewDetail name='Status' className='mb-3'>
                <Badge
                  text={userStatusToTitleCase(profileUser.status)}
                  color={userStatusToColor(profileUser.status)} />
              </ViewDetail>)
            : null}
          <ViewDetail name='Account Type'>
            {userTypeToTitleCase(profileUser.type)}
          </ViewDetail>
          <ViewPermissions {...props} />
        </div>
      </Col>
    </Row>
  );
};

const ViewProfileFormHeading: ComponentView<State, Msg> = ({ state, dispatch }) => {
  // Admins can't edit other user profiles.
  if (isAdmin(state.viewerUser) && !usersAreEquivalent(state.profileUser, state.viewerUser)) { return null; }
  const isStartEditingFormLoading = state.startEditingFormLoading > 0;
  const isEditingForm = state.isEditingForm;
  return (
    <Row>
      <Col xs='12' className='mb-4 d-flex flex-nowrap flex-column flex-md-row align-items-start align-items-md-center'>
        <h3 className='mb-0'>Profile Information</h3>
        {isEditingForm
          ? null
          : (<LoadingButton
              onClick={() => dispatch(adt('startEditingForm'))}
              className='mt-2 mt-md-0 ml-md-3'
              size='sm'
              loading={isStartEditingFormLoading}
              symbol_={leftPlacement(iconLinkSymbol('user-edit'))}
              color='primary'>
              Edit Profile
            </LoadingButton>)}
      </Col>
    </Row>
  );
};

const ViewProfileFormButtons: ComponentView<State, Msg> = ({ state, dispatch }) => {
  const isEditingForm = state.isEditingForm;
  // Admins can't edit other user profiles.
  if (isAdmin(state.viewerUser) && !usersAreEquivalent(state.profileUser, state.viewerUser)) { return null; }
  if (!isEditingForm) { return null; }
  const isSaveChangesLoading = state.saveChangesLoading > 0;
  const isStartEditingFormLoading = state.startEditingFormLoading > 0;
  const isDisabled = !isEditingForm || isSaveChangesLoading || isStartEditingFormLoading;
  const isValid = ProfileForm.isValid(state.profileForm);
  return (
    <Row className='mt-4'>
      <Col xs='12' className='py-1 d-flex flex-nowrap flex-row flex-md-row-reverse align-items-center overflow-auto'>
          <Fragment>
            <LoadingButton
              disabled={!isValid || isDisabled}
              onClick={() => dispatch(adt('saveChanges'))}
              loading={isSaveChangesLoading}
              symbol_={leftPlacement(iconLinkSymbol('user-check'))}
              color='primary'>
              Save Changes
            </LoadingButton>
            <Link
              disabled={isDisabled}
              onClick={() => dispatch(adt('cancelEditingForm'))}
              color='secondary'
              className='px-3'>
              Cancel
            </Link>
          </Fragment>
      </Col>
    </Row>
  );
};

const ViewProfileForm: ComponentView<State, Msg> = props => {
  const { state, dispatch } = props;
  const isSaveChangesLoading = state.saveChangesLoading > 0;
  const isStartEditingFormLoading = state.startEditingFormLoading > 0;
  const isEditingForm = state.isEditingForm;
  const isDisabled = !isEditingForm || isSaveChangesLoading || isStartEditingFormLoading;
  return (
    <div>
      <ViewProfileFormHeading {...props} />
      <ProfileForm.view
        disabled={isDisabled}
        state={state.profileForm}
        dispatch={mapComponentDispatch(dispatch, value => adt('profileForm' as const, value))} />
      <ViewProfileFormButtons {...props} />
    </div>
  );
};

const ViewDeactivateAccount: ComponentView<State, Msg> = ({ state, dispatch }) => {
  // Admins can't deactivate their own accounts
  if (isAdmin(state.profileUser) && usersAreEquivalent(state.profileUser, state.viewerUser)) { return null; }
  const isDeactivateAccountLoading = state.deactivateAccountLoading > 0;
  return (
    <Row>
      <Col xs='12'>
        <div className='mt-5 pt-5 border-top'>
          <h3>Deactivate Account</h3>
          <p>Deactivating your account means that you will no longer have access to the Digital Marketplace.</p>
          <LoadingButton
            loading={isDeactivateAccountLoading}
            disabled={isDeactivateAccountLoading}
            onClick={() => dispatch(adt('deactivateAccount'))}
            symbol_={leftPlacement(iconLinkSymbol('user-minus'))}
            className='mt-4'
            color='danger'>
            Deactivate Account
          </LoadingButton>
        </div>
      </Col>
    </Row>
  );
};

const view: ComponentView<State, Msg> = props => {
  const { state } = props;
  const profileUser = state.profileUser;
  return (
    <div>
      <Row className='mb-4'>
        <Col xs='12'>
          <h1>{profileUser.name}</h1>
        </Col>
    </Row>
    <ViewDetails {...props} />
    <ViewProfileForm {...props} />
    <ViewDeactivateAccount {...props} />
  </div>
  );
};

export const component: Tab.Component<Params, State, Msg> = {
  init,
  update,
  view
};