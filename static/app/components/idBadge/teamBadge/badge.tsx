import * as React from 'react';

import BadgeDisplayName from 'sentry/components/idBadge/badgeDisplayName';
import BaseBadge from 'sentry/components/idBadge/baseBadge';

type BaseBadgeProps = React.ComponentProps<typeof BaseBadge>;
type Team = NonNullable<BaseBadgeProps['team']>;

type Props = Partial<Omit<BaseBadgeProps, 'project' | 'organization' | 'team'>> & {
  team: Team;
  // If true, will use default max-width, or specify one as a string
  hideOverflow?: boolean | string;
};

const Badge = ({hideOverflow = true, team, ...props}: Props) => (
  <BaseBadge
    data-test-id="team-badge"
    displayName={
      <BadgeDisplayName hideOverflow={hideOverflow}>{`#${team.slug}`}</BadgeDisplayName>
    }
    team={team}
    {...props}
  />
);

export default Badge;
