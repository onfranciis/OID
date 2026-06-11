import { Test, TestingModule } from '@nestjs/testing';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { BetterAuthController } from './better-auth.controller';
import { BetterAuthService } from './better-auth.service';

describe('BetterAuthController', () => {
  let controller: BetterAuthController;
  const handle = vi.fn(() => Promise.resolve());

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [BetterAuthController],
      providers: [
        {
          provide: BetterAuthService,
          useValue: {
            handle,
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(BetterAuthController);
  });

  beforeEach(() => {
    handle.mockClear();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('passes supported authorize requests through to Better Auth', async () => {
    await expect(
      controller.authorize(
        {
          query: {
            response_type: 'code',
            state: 'opaque-state',
            code_challenge: 'opaque-challenge',
            code_challenge_method: 'S256',
          },
        } as never,
        {} as never,
      ),
    ).resolves.toBeUndefined();

    expect(handle).toHaveBeenCalledTimes(1);
  });

  it('rejects unsupported authorize response types at the controller boundary', async () => {
    await expect(
      controller.authorize(
        {
          query: {
            response_type: 'token',
            state: 'opaque-state',
            code_challenge: 'opaque-challenge',
            code_challenge_method: 'S256',
          },
        } as never,
        {} as never,
      ),
    ).rejects.toThrow(/response_type=code/);

    expect(handle).not.toHaveBeenCalled();
  });

  it('rejects plain PKCE at the controller boundary', async () => {
    await expect(
      controller.authorize(
        {
          query: {
            response_type: 'code',
            state: 'opaque-state',
            code_challenge: 'opaque-challenge',
            code_challenge_method: 'plain',
          },
        } as never,
        {} as never,
      ),
    ).rejects.toThrow(/S256/);

    expect(handle).not.toHaveBeenCalled();
  });

  it('passes supported token grants through to Better Auth', async () => {
    await expect(
      controller.token(
        {
          body: {
            grant_type: 'authorization_code',
          },
        } as never,
        {} as never,
      ),
    ).resolves.toBeUndefined();

    expect(handle).toHaveBeenCalledTimes(1);
  });

  it('rejects unsupported token grants at the controller boundary', async () => {
    await expect(
      controller.token(
        {
          body: {
            grant_type: 'client_credentials',
          },
        } as never,
        {} as never,
      ),
    ).rejects.toThrow(/authorization_code and refresh_token/);

    expect(handle).not.toHaveBeenCalled();
  });

  it('blocks dynamic registration routes before Better Auth sees them', () => {
    expect(() => controller.blockRegister()).toThrow(
      /Dynamic client registration/,
    );

    expect(handle).not.toHaveBeenCalled();
  });
});
