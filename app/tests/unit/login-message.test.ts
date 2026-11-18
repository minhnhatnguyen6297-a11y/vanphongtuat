import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loginFailureMessage } from '../../src/client/login-message.ts';

describe('login failure copy', () => {
  it('keeps wrong credentials, network, rejection and lockout apart', () => {
    assert.equal(loginFailureMessage('bad_credentials'), 'Tên đăng nhập hoặc PIN không đúng.');
    assert.equal(loginFailureMessage('bad'), 'Tên đăng nhập hoặc PIN không đúng.');
    assert.equal(loginFailureMessage('network'), 'Mất kết nối mạng.');
    assert.equal(loginFailureMessage('csrf'), 'Yêu cầu bị từ chối.');
    assert.equal(loginFailureMessage('rejected'), 'Yêu cầu bị từ chối.');
    assert.equal(loginFailureMessage(undefined), 'Yêu cầu bị từ chối.');
    assert.equal(loginFailureMessage('rate_limited'), 'Thử quá nhiều lần. Đợi rồi thử lại.');
    assert.equal(loginFailureMessage('locked', 5), 'Tài khoản đang khóa. Thử lại sau 5 phút.');
  });
});
