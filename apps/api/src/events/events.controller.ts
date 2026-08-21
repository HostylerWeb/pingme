import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateEventCommentSchema,
  CreateEventSchema,
  EventImageConfirmSchema,
  MediaUploadBase64Schema,
  EventRsvpSchema,
  EventRsvpWithdrawSchema,
  MessageEventHostSchema,
  UpdateEventSchema,
  CreateEventInput,
  UpdateEventInput,
  EventRsvpInput,
  EventRsvpWithdrawInput,
  CreateEventCommentInput,
  MessageEventHostInput,
  EventImageConfirmInput,
  MediaUploadBase64Input,
} from '@pingme/shared';
import { User } from '@pingme/db';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IdVerifiedGuard } from '../verification/guards/id-verified.guard';
import { VerifiedGuard } from '../verification/guards/verified.guard';
import { EventsService } from './events.service';

@ApiTags('events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get('nearby')
  @ApiOperation({ summary: 'List nearby events' })
  listNearby(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.eventsService.listNearby(
      user.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Get('mine')
  @ApiOperation({ summary: 'List events hosted by current user' })
  listMine(@CurrentUser() user: User) {
    return this.eventsService.listMine(user.id);
  }

  @Get('attending')
  @ApiOperation({ summary: 'List events the current user RSVP’d to (going or maybe)' })
  listAttending(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('lifecycle') lifecycle?: 'upcoming' | 'past',
  ) {
    return this.eventsService.listAttending(
      user.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      lifecycle ?? 'upcoming',
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get event detail' })
  getEvent(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.getEvent(user.id, id);
  }

  @Post()
  @UseGuards(IdVerifiedGuard)
  @ApiOperation({ summary: 'Create event (ID verified hosts only)' })
  createEvent(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(CreateEventSchema)) dto: CreateEventInput,
  ) {
    return this.eventsService.createEvent(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update own event' })
  updateEvent(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateEventSchema)) dto: UpdateEventInput,
  ) {
    return this.eventsService.updateEvent(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel own event' })
  cancelEvent(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.cancelEvent(user.id, id);
  }

  @Post(':id/images/presign')
  @ApiOperation({ summary: 'Get presigned upload URL for event image' })
  presignImage(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { fileName: string; contentType: string },
  ) {
    return this.eventsService.presignImage(user.id, id, body.fileName, body.contentType);
  }

  @Post(':id/images/upload-base64')
  @ApiOperation({ summary: 'Upload event image as base64 (fallback when R2 is not configured)' })
  uploadImageBase64(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(MediaUploadBase64Schema)) dto: MediaUploadBase64Input,
  ) {
    const buffer = Buffer.from(dto.data, 'base64');
    return this.eventsService.uploadImageDirect(user.id, id, dto.key, {
      buffer,
      mimetype: dto.contentType,
    });
  }

  @Post(':id/images')
  @ApiOperation({ summary: 'Add images to event' })
  addImages(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(EventImageConfirmSchema)) dto: EventImageConfirmInput,
  ) {
    return this.eventsService.addImages(user.id, id, dto);
  }

  @Delete(':id/images/:imageId')
  @ApiOperation({ summary: 'Remove an event image' })
  removeImage(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.eventsService.removeImage(user.id, id, imageId);
  }

  @Post(':id/rsvp')
  @UseGuards(VerifiedGuard)
  @ApiOperation({ summary: 'RSVP going or maybe' })
  upsertRsvp(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(EventRsvpSchema)) dto: EventRsvpInput,
  ) {
    return this.eventsService.upsertRsvp(user.id, id, dto);
  }

  @Post(':id/rsvp/withdraw')
  @ApiOperation({ summary: 'Withdraw RSVP with a reason' })
  withdrawRsvp(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(EventRsvpWithdrawSchema)) dto: EventRsvpWithdrawInput,
  ) {
    return this.eventsService.withdrawRsvp(user.id, id, dto);
  }

  @Delete(':id/rsvp')
  @ApiOperation({ summary: 'Cancel RSVP (deprecated — use withdraw with reason)' })
  cancelRsvp(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.cancelRsvp(user.id, id);
  }

  @Get(':id/comments')
  @ApiOperation({ summary: 'List event comments' })
  listComments(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.eventsService.listComments(
      user.id,
      id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 30,
    );
  }

  @Post(':id/comments')
  @UseGuards(VerifiedGuard)
  @ApiOperation({ summary: 'Post comment on event' })
  createComment(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CreateEventCommentSchema)) dto: CreateEventCommentInput,
  ) {
    return this.eventsService.createComment(user.id, id, dto);
  }

  @Delete(':id/comments/:commentId')
  @ApiOperation({ summary: 'Delete own comment or host deletes comment' })
  deleteComment(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ) {
    return this.eventsService.deleteComment(user.id, id, commentId);
  }

  @Post(':id/message-host')
  @UseGuards(VerifiedGuard)
  @ApiOperation({ summary: 'Start chat with event host' })
  messageHost(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(MessageEventHostSchema)) dto: MessageEventHostInput,
  ) {
    return this.eventsService.messageHost(user.id, id, dto);
  }
}
