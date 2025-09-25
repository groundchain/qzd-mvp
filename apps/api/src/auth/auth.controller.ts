import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import type { RegisterRequest } from '../../generated/server/model/registerRequest.js';
import type { LoginRequest } from '../../generated/server/model/loginRequest.js';
import { registerSchema, loginSchema } from './auth.schemas.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Begin registration by sending an OTP to the provided phone number.' })
  async register(@Body() dto: RegisterRequest) {
    const payload = registerSchema.parse(dto);
    return this.authService.register(payload);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete login by exchanging an OTP for an access token.' })
  async login(@Body() dto: LoginRequest) {
    const payload = loginSchema.parse(dto);
    return this.authService.login(payload);
  }
}
