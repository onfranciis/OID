import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import { OidcClientEntity } from './oidc-client.entity';

@Entity({ name: 'oidc_post_logout_redirect_uris' })
@Unique('uq_oidc_post_logout_redirect_uris_client_uri', ['clientId', 'uri'])
export class OidcPostLogoutRedirectUriEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ name: 'client_id', type: 'text' })
  clientId!: string;

  @Column({ type: 'text' })
  uri!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(
    () => OidcClientEntity,
    (client) => client.postLogoutRedirectUris,
    {
      onDelete: 'RESTRICT',
    },
  )
  @JoinColumn({ name: 'client_id' })
  client!: OidcClientEntity;
}
