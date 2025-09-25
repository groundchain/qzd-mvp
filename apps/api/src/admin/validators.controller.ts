import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service.js';
import type { SignValidatorRequest } from '../../generated/server/model/signValidatorRequest.js';
import { signValidatorSchema } from './admin.schemas.js';

@ApiTags('validators')
@Controller('validators')
export class ValidatorsController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @ApiOperation({ summary: 'List registered validators.' })
  async list() {
    return this.adminService.listValidators();
  }

  @Post('sign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Simulate signing with the admin validator key.' })
  async sign(@Body() dto: SignValidatorRequest) {
    const payload = signValidatorSchema.parse(dto);
    return this.adminService.sign(payload);
  }
}
