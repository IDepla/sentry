import * as React from 'react';

import Alert from 'sentry/components/alert';
import {IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Config, Organization, Scope} from 'sentry/types';
import {isRenderFunc} from 'sentry/utils/isRenderFunc';
import withConfig from 'sentry/utils/withConfig';
import withOrganization from 'sentry/utils/withOrganization';

const DEFAULT_NO_ACCESS_MESSAGE = (
  <Alert type="error" icon={<IconInfo size="md" />}>
    {t('You do not have sufficient permissions to access this.')}
  </Alert>
);

// Props that function children will get.
export type ChildRenderProps = {
  hasAccess: boolean;
  hasSuperuser: boolean;
};

type ChildFunction = (props: ChildRenderProps) => React.ReactNode;

type DefaultProps = {
  /**
   * Should the component require all access levels or just one or more.
   */
  requireAll?: boolean;

  /**
   * Requires superuser
   */
  isSuperuser?: boolean;

  /**
   * Custom renderer function for "no access" message OR `true` to use
   * default message. `false` will suppress message.
   */
  renderNoAccessMessage: ChildFunction | boolean;

  /**
   * List of required access levels
   */
  access: Scope[];
};

const defaultProps: DefaultProps = {
  renderNoAccessMessage: false,
  isSuperuser: false,
  requireAll: true,
  access: [],
};

type Props = {
  /**
   * Current Organization
   */
  organization: Organization;

  /**
   * Configuration from ConfigStore
   */
  config: Config;

  /**
   * Children can be a node or a function as child.
   */
  children?: React.ReactNode | ChildFunction;
} & Partial<DefaultProps>;

/**
 * Component to handle access restrictions.
 */
class Access extends React.Component<Props> {
  static defaultProps = defaultProps;

  render() {
    const {
      organization,
      config,
      access,
      requireAll,
      isSuperuser,
      renderNoAccessMessage,
      children,
    } = this.props;

    const {access: orgAccess} = organization || {access: []};
    const method = requireAll ? 'every' : 'some';

    const hasAccess = !access || access[method](acc => orgAccess.includes(acc));
    const hasSuperuser = !!(config.user && config.user.isSuperuser);

    const renderProps: ChildRenderProps = {
      hasAccess,
      hasSuperuser,
    };

    const render = hasAccess && (!isSuperuser || hasSuperuser);

    if (!render && typeof renderNoAccessMessage === 'function') {
      return renderNoAccessMessage(renderProps);
    }
    if (!render && renderNoAccessMessage) {
      return DEFAULT_NO_ACCESS_MESSAGE;
    }

    if (isRenderFunc<ChildFunction>(children)) {
      return children(renderProps);
    }

    return render ? children : null;
  }
}

export default withOrganization(withConfig(Access));
