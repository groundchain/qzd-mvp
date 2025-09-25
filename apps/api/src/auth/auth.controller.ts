import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { RegisterDto, RegisterSchema } from './dto/register.dto.js';
import { LoginDto, LoginSchema } from './dto/login.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Begin registration by sending an OTP to the provided phone number.' })
  async register(@Body() dto: RegisterDto) {
    const payload = RegisterSchema.parse(dto);
    return this.authService.register(payload);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete login by exchanging an OTP for an access token.' })
  async login(@Body() dto: LoginDto) {
    const payload = LoginSchema.parse(dto);
    return this.authService.login(payload);
  }
}
